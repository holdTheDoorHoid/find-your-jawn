import json

from helpers import location, make_group

from fyj.geo import (
    DistrictLocator,
    assign_planning_districts,
    douglas_peucker,
    simplify_geojson,
)
from fyj.groupfile import GroupStore

SQUARE_A = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]
SQUARE_B = [[1, 0], [1, 1], [2, 1], [2, 0], [1, 0]]
HOLE = [[0.4, 0.4], [0.4, 0.6], [0.6, 0.6], [0.6, 0.4], [0.4, 0.4]]


def feature(name, *rings):
    return {
        "type": "Feature",
        "properties": {"dist_name": name, "abbrev": name[:2].upper(), "objectid": 1},
        "geometry": {"type": "Polygon", "coordinates": [list(r) for r in rings]},
    }


def test_simplify_keeps_names_and_rounds_coordinates():
    raw = {
        "type": "FeatureCollection",
        "features": [
            feature(
                "Central",
                [
                    [0.1234567, 0.1234567],
                    [0.1234567, 1.5],
                    [1.5, 1.5],
                    [1.5, 0.1234567],
                    [0.1234567, 0.1234567],
                ],
            )
        ],
    }
    simple = simplify_geojson(raw)
    f = simple["features"][0]
    assert f["properties"] == {"name": "Central", "abbrev": "CE"}
    assert f["geometry"]["type"] == "MultiPolygon"
    assert f["geometry"]["coordinates"][0][0][0] == [0.12346, 0.12346]


def test_douglas_peucker_drops_points_on_a_straight_line():
    line = [(0.0, 0.0), (0.5, 0.0000001), (1.0, 0.0)]
    assert douglas_peucker(line, 1e-5) == [(0.0, 0.0), (1.0, 0.0)]


def locator(vocab):
    geo = simplify_geojson(
        {
            "type": "FeatureCollection",
            "features": [
                feature("Lower North", SQUARE_A, HOLE),  # lng 0 to 1 with a hole
                feature("Central", SQUARE_B),
            ],
        }
    )
    return DistrictLocator(geo["features"], vocab)


def test_point_in_polygon_with_a_hole(vocab):
    loc = locator(vocab)
    assert loc.by_point(lat=0.2, lng=0.2) == "lower_north"
    assert loc.by_point(lat=0.5, lng=0.5) is None  # inside the hole
    assert loc.by_point(lat=0.5, lng=1.5) == "central"
    assert loc.by_point(lat=5, lng=5) is None


def test_a_location_without_coordinates_falls_back_to_the_zip_map(vocab):
    loc = locator(vocab)
    assert loc({"lat": None, "lng": None, "zip": "19104"}) == "west"
    assert loc({"lat": 0.2, "lng": 0.2, "zip": "19104"}) == "lower_north"  # point beats ZIP
    assert loc({"lat": None, "lng": None, "zip": "99999"}) is None


def test_assign_planning_districts_updates_only_what_changes(layout, vocab):
    make_group(
        layout,
        "a-one",
        "A one",
        locations=[
            location(label="x", lat=0.2, lng=0.2, zip="19104"),
            location(label="y", zip="19103"),
        ],
    )
    make_group(layout, "b-two", "B two", locations=[location(label="z", zip="99999")])
    counts = assign_planning_districts(layout, locator(vocab))
    assert counts == {"locations": 3, "by_point": 1, "by_zip": 1, "none": 1, "files_changed": 1}
    group = GroupStore(layout.groups_dir).read("a-one")
    assert [loc["planning_district"] for loc in group["locations"]] == ["lower_north", "central"]
    again = assign_planning_districts(layout, locator(vocab))
    assert again["files_changed"] == 0
    json.dumps(group)
