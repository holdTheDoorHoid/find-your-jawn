"""Planning districts: fetch the City's polygons, shrink them, and place locations in them.

The polygons come from the City's ArcGIS layer (see registry/sources.yaml, id planning_districts).
Point in polygon is plain Python ray casting, so no geometry library is needed. A location with no
coordinates falls back to the ZIP map in data/vocab/neighborhoods.yaml.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fyj.groupfile import GroupStore
from fyj.http import FyjClient
from fyj.paths import Layout, cache_dir
from fyj.textutil import slugify
from fyj.vocab import Vocab

LAYER_URL = (
    "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/"
    "Planning_Districts/FeatureServer/0/query"
)
RAW_CACHE_KEY = "planning_districts/planning_districts_raw.geojson"


def fetch_raw(client: FyjClient, *, force: bool = False) -> Path:
    """Download the layer as GeoJSON in WGS84 into $FYJ_CACHE and return the path."""
    path = client.cache_root / RAW_CACHE_KEY
    if path.exists() and not force:
        return path
    resp = client.get(
        LAYER_URL,
        params={"where": "1=1", "outFields": "*", "outSR": "4326", "f": "geojson"},
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("type") != "FeatureCollection" or not data.get("features"):
        raise ValueError("the planning district layer returned no features")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


# -- simplifying --


def _perp_distance(point, start, end) -> float:
    (x, y), (x1, y1), (x2, y2) = point, start, end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return ((x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2) ** 0.5


def douglas_peucker(
    points: list[tuple[float, float]], tolerance: float
) -> list[tuple[float, float]]:
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        lo, hi = stack.pop()
        far, far_d = -1, 0.0
        for i in range(lo + 1, hi):
            d = _perp_distance(points[i], points[lo], points[hi])
            if d > far_d:
                far, far_d = i, d
        if far_d > tolerance:
            keep[far] = True
            stack.append((lo, far))
            stack.append((far, hi))
    return [p for p, k in zip(points, keep, strict=True) if k]


def _simplify_ring(ring: list[list[float]], decimals: int, tolerance: float) -> list[list[float]]:
    rounded = [(round(x, decimals), round(y, decimals)) for x, y in (c[:2] for c in ring)]
    # a closed ring: simplify the open part, then close it again
    closed = len(rounded) > 1 and rounded[0] == rounded[-1]
    body = rounded[:-1] if closed else rounded
    body = douglas_peucker(body, tolerance)
    deduped = [p for i, p in enumerate(body) if i == 0 or p != body[i - 1]]
    if closed:
        deduped.append(deduped[0])
    return [[x, y] for x, y in deduped]


def simplify_geojson(raw: dict[str, Any], decimals: int = 5, tolerance: float = 5e-6) -> dict:
    """Keep only the district name and abbreviation, round coordinates, and drop points that do
    not change the outline by more than about half a meter."""
    features = []
    for feature in raw["features"]:
        props = feature.get("properties") or {}
        geometry = feature["geometry"]
        polygons = (
            [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        )
        simple = []
        for polygon in polygons:
            rings = [_simplify_ring(r, decimals, tolerance) for r in polygon]
            rings = [r for r in rings if len(r) >= 4]
            if rings:
                simple.append(rings)
        features.append(
            {
                "type": "Feature",
                "properties": {"name": props.get("dist_name"), "abbrev": props.get("abbrev")},
                "geometry": {"type": "MultiPolygon", "coordinates": simple},
            }
        )
    features.sort(key=lambda f: f["properties"]["name"] or "")
    return {"type": "FeatureCollection", "features": features}


def write_simplified(raw_path: Path, out_path: Path) -> int:
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    simple = simplify_geojson(raw)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(simple, separators=(",", ":")) + "\n"
    out_path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


# -- point in polygon --


def _inside_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class DistrictLocator:
    """Gives a location its planning district id."""

    def __init__(self, features: list[dict[str, Any]], vocab: Vocab) -> None:
        self.vocab = vocab
        self.shapes: list[tuple[str, tuple[float, float, float, float], list]] = []
        for feature in features:
            name = (feature.get("properties") or {}).get("name") or ""
            district = vocab.resolve_district(name) or slugify(name).replace("-", "_")
            geometry = feature["geometry"]
            polygons = (
                [geometry["coordinates"]]
                if geometry["type"] == "Polygon"
                else geometry["coordinates"]
            )
            for polygon in polygons:
                xs = [c[0] for c in polygon[0]]
                ys = [c[1] for c in polygon[0]]
                self.shapes.append((district, (min(xs), min(ys), max(xs), max(ys)), polygon))

    @classmethod
    def load(cls, layout: Layout, vocab: Vocab) -> DistrictLocator:
        path = layout.planning_districts_path
        features: list[dict[str, Any]] = []
        if path.exists():
            features = json.loads(path.read_text(encoding="utf-8")).get("features", [])
        return cls(features, vocab)

    @property
    def has_geometry(self) -> bool:
        return bool(self.shapes)

    def by_point(self, lat: float, lng: float) -> str | None:
        for district, (minx, miny, maxx, maxy), polygon in self.shapes:
            if not (minx <= lng <= maxx and miny <= lat <= maxy):
                continue
            if _inside_ring(lng, lat, polygon[0]) and not any(
                _inside_ring(lng, lat, hole) for hole in polygon[1:]
            ):
                return district
        return None

    def __call__(self, location: dict[str, Any]) -> str | None:
        lat, lng = location.get("lat"), location.get("lng")
        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            district = self.by_point(float(lat), float(lng))
            if district:
                return district
        zip_code = location.get("zip")
        if zip_code:
            return self.vocab.zip_districts.get(str(zip_code)[:5])
        return None


def assign_planning_districts(
    layout: Layout, locator: DistrictLocator, *, force: bool = False
) -> dict[str, int]:
    """Set planning_district on every location of every group. Only changed files are rewritten."""
    store = GroupStore(layout.groups_dir)
    counts = {"locations": 0, "by_point": 0, "by_zip": 0, "none": 0, "files_changed": 0}
    with store.lock():
        for group in store.iter_groups():
            changed = False
            for loc in group["locations"]:
                counts["locations"] += 1
                if loc.get("planning_district") and not force:
                    continue
                district = locator(loc)
                has_point = isinstance(loc.get("lat"), (int, float)) and isinstance(
                    loc.get("lng"), (int, float)
                )
                if district is None:
                    counts["none"] += 1
                    continue
                if has_point and locator.by_point(float(loc["lat"]), float(loc["lng"])) == district:
                    counts["by_point"] += 1
                else:
                    counts["by_zip"] += 1
                if loc.get("planning_district") != district:
                    loc["planning_district"] = district
                    changed = True
            if changed:
                store.write(group)
                counts["files_changed"] += 1
    return counts


def refresh_geometry(layout: Layout, *, force: bool = False) -> int:
    """Download (or reuse the cached download of) the layer and write the committed copy.
    Returns the size in bytes of data/geo/planning_districts.geojson."""
    with FyjClient() as client:
        raw_path = fetch_raw(client, force=force)
    return write_simplified(raw_path, layout.planning_districts_path)


def raw_cache_path() -> Path:
    return cache_dir() / RAW_CACHE_KEY
