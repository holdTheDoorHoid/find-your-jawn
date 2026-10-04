"""City of Philadelphia ArcGIS layers: RCOs, Friends groups, NACs, gardens, and facility anchors.

All of these live on the city's public ArcGIS Online organization at
services.arcgis.com/fLeGjb7u4uXqeF9q, need no authentication, and support the standard
resultOffset/resultRecordCount pagination. We always ask for outSR=4326 so geometry comes back
as plain WGS84 longitude/latitude instead of the service's native web mercator.
"""

from __future__ import annotations

import re
from typing import Any

from fyj.http import FyjClient
from fyj.leads import clean_text, clean_zip, make_lead

BASE = "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services"

ZONING_RCO_URL = f"{BASE}/Zoning_RCO/FeatureServer/0"
RCO_POINTS_URL = f"{BASE}/RCO_Points/FeatureServer/0"
PPR_FRIENDS_URL = f"{BASE}/PPR_Friends_Groups/FeatureServer/0"
NAC_URL = f"{BASE}/NeighborhoodAdvisoryCommittees/FeatureServer/0"
GARDENS_URL = f"{BASE}/Registered_Community_Gardens/FeatureServer/0"
LIBRARIES_URL = f"{BASE}/Free_Library_Locations/FeatureServer/0"
REC_CENTERS_URL = f"{BASE}/Philadelphia_Parks_and_Recreation_Centers/FeatureServer/0"
PCA_SENIOR_URL = f"{BASE}/PCA_SeniorCenters/FeatureServer/0"
SENIOR_SITES_URL = f"{BASE}/Senior_Sites_PUBLIC_VIEW/FeatureServer/0"

ZIP_RE = re.compile(r"\b(\d{5})(?:-\d{4})?\b")


# --------------------------------------------------------------------------------------
# network fetch
# --------------------------------------------------------------------------------------


def fetch_all_features(
    client: FyjClient,
    layer_url: str,
    *,
    out_sr: int = 4326,
    page_size: int = 1000,
    where: str = "1=1",
) -> list[dict[str, Any]]:
    """Page through an ArcGIS FeatureServer layer and return every feature's attributes+geometry."""
    features: list[dict[str, Any]] = []
    offset = 0
    while True:
        params = {
            "where": where,
            "outFields": "*",
            "f": "json",
            "outSR": out_sr,
            "resultRecordCount": page_size,
            "resultOffset": offset,
        }
        data = client.get_json(f"{layer_url}/query", params=params)
        if "error" in data:
            raise RuntimeError(f"ArcGIS error from {layer_url}: {data['error']}")
        page = data.get("features", [])
        features.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return features


# --------------------------------------------------------------------------------------
# geometry helpers
# --------------------------------------------------------------------------------------


def point_latlng(feature: dict[str, Any]) -> tuple[float | None, float | None]:
    geom = feature.get("geometry") or {}
    x, y = geom.get("x"), geom.get("y")
    if x is None or y is None:
        return None, None
    return y, x  # geometry is {x: lng, y: lat} once outSR=4326


def polygon_centroid(feature: dict[str, Any]) -> tuple[float | None, float | None]:
    """A simple average-of-vertices centroid of the largest ring. Good enough for compact
    neighborhood polygons; docs/DATA_MODEL.md accepts null when an exact centroid is hard."""
    geom = feature.get("geometry") or {}
    rings = geom.get("rings") or []
    if not rings:
        return None, None
    largest = max(rings, key=len)
    if not largest:
        return None, None
    lngs = [pt[0] for pt in largest]
    lats = [pt[1] for pt in largest]
    return sum(lats) / len(lats), sum(lngs) / len(lngs)


def find_zip(*texts: str | None) -> str | None:
    for text in texts:
        if not text:
            continue
        match = ZIP_RE.search(text)
        if match:
            return match.group(1)
    return None


def _join_address(*parts: str | None) -> str | None:
    cleaned = [clean_text(p) for p in parts]
    cleaned = [p.replace("\r\n", ", ").replace("\n", ", ") for p in cleaned if p]
    return ", ".join(cleaned) if cleaned else None


# --------------------------------------------------------------------------------------
# parsers (pure functions, no network, fixture-testable)
# --------------------------------------------------------------------------------------


def parse_zoning_rco(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = str(a.get("lni_id") or a.get("objectid"))
        address = _join_address(a.get("organization_address"))
        lat, lng = polygon_centroid(feat)
        website = clean_text(a.get("websites"))
        leads.append(
            make_lead(
                source="city_rco",
                source_url=ZONING_RCO_URL,
                native_id=native_id,
                name=clean_text(a.get("organization_name")) or "Unknown RCO",
                kind_hint="civic",
                website=website,
                email=clean_text(a.get("primary_email")),
                phone=clean_text(a.get("primary_phone")),
                contact_name=clean_text(a.get("primary_name")),
                address=address,
                city="Philadelphia",
                zip=find_zip(a.get("organization_address"), a.get("meeting_location_address")),
                lat=lat,
                lng=lng,
                meeting_place=_join_address(a.get("meeting_location_address")),
                tags_hint=[a["org_type"]] if clean_text(a.get("org_type")) else [],
                extra={
                    "org_type": a.get("org_type"),
                    "preferred_contact_method": a.get("preffered_contact_method"),
                    "alternate_name": a.get("alternate_name"),
                    "alternate_address": a.get("alternate_address"),
                    "alternate_email": a.get("alternate_email"),
                    "alternate_phone": a.get("alternate_phone"),
                    "expirationyear": a.get("expirationyear"),
                    "effective_date": a.get("effective_date"),
                    "lni_id": a.get("lni_id"),
                    "objectid": a.get("objectid"),
                },
            )
        )
    return leads


def parse_rco_points(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = str(a.get("LNI_ID") or a.get("OBJECTID"))
        lat, lng = point_latlng(feat)
        leads.append(
            make_lead(
                source="city_rco_points",
                source_url=RCO_POINTS_URL,
                native_id=native_id,
                name=clean_text(a.get("ORGANIZATI")) or "Unknown RCO",
                kind_hint="civic",
                email=clean_text(a.get("PRIMARY_EM")),
                phone=clean_text(a.get("PRIMARY_PH")),
                contact_name=clean_text(a.get("PRIMARY_NA")),
                address=_join_address(a.get("ORGANIZA_1")),
                city="Philadelphia",
                zip=find_zip(a.get("ORGANIZA_1"), a.get("MEETING_LO")),
                lat=lat,
                lng=lng,
                meeting_place=_join_address(a.get("MEETING_LO")),
                tags_hint=[a["ORG_TYPE"]] if clean_text(a.get("ORG_TYPE")) else [],
                extra={
                    "org_type": a.get("ORG_TYPE"),
                    "alternate_name": a.get("ALTERNATE_"),
                    "alternate_address": a.get("ALTERNAT_1"),
                    "alternate_email": a.get("ALTERNAT_2"),
                    "alternate_phone": a.get("ALTERNAT_3"),
                    "expirationyear": a.get("EXPIRATION"),
                    "lni_id": a.get("LNI_ID"),
                    "objectid": a.get("OBJECTID"),
                    "note": "older/parallel RCO layer, cross check against city_rco",
                },
            )
        )
    return leads


def parse_ppr_friends(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = str(a.get("objectid"))
        lat, lng = point_latlng(feat)
        name = clean_text(a.get("friends_group_name")) or clean_text(a.get("public_name"))
        public_name = clean_text(a.get("public_name"))
        aka = [public_name] if public_name and public_name != name else []
        leads.append(
            make_lead(
                source="city_friends",
                source_url=PPR_FRIENDS_URL,
                native_id=native_id,
                name=name or "Unknown friends group",
                aka=aka,
                kind_hint="friends_group",
                website=clean_text(a.get("contact_website")),
                email=clean_text(a.get("contact_email")),
                address=clean_text(a.get("address")),
                city="Philadelphia",
                zip=clean_zip(a.get("zip_code")),
                lat=lat,
                lng=lng,
                extra={
                    "parent_name": a.get("parent_name"),
                    "ppr_prog_district": a.get("ppr_prog_district"),
                    "ppr_ops_district": a.get("ppr_ops_district"),
                    "council_district": a.get("council_district"),
                    "police_district": a.get("police_district"),
                    "comments": a.get("comments"),
                },
            )
        )
    return leads


def parse_nac(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = str(a.get("objectid"))
        lat, lng = polygon_centroid(feat)
        leads.append(
            make_lead(
                source="city_nac",
                source_url=NAC_URL,
                native_id=native_id,
                name=clean_text(a.get("organization")) or "Unknown NAC organization",
                kind_hint="civic",
                website=clean_text(a.get("website_url")),
                email=clean_text(a.get("email_address")),
                phone=clean_text(a.get("phone_number")),
                contact_name=clean_text(a.get("nac_coordinator")),
                address=clean_text(a.get("street_address")),
                city="Philadelphia",
                zip=clean_zip(a.get("zip_code")),
                lat=lat,
                lng=lng,
                tags_hint=["Neighborhood Advisory Committee"],
            )
        )
    return leads


_HOUR_FIELDS = (
    "hours_sunday",
    "hours_monday",
    "hours_tuesday",
    "hours_wednesday",
    "hours_thursday",
    "hours_friday",
    "hours_saturday",
)


def _garden_schedule_text(a: dict[str, Any]) -> str | None:
    day_labels = {
        "hours_sunday": "Sun",
        "hours_monday": "Mon",
        "hours_tuesday": "Tue",
        "hours_wednesday": "Wed",
        "hours_thursday": "Thu",
        "hours_friday": "Fri",
        "hours_saturday": "Sat",
    }
    parts = []
    for field in _HOUR_FIELDS:
        value = clean_text(a.get(field))
        if value and value.upper() != "N/A":
            parts.append(f"{day_labels[field]} {value}")
    return "; ".join(parts) if parts else None


def parse_gardens(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = str(a.get("objectid"))
        lat, lng = point_latlng(feat)
        name = clean_text(a.get("garden_name")) or "Unknown garden"
        alias = clean_text(a.get("garden_alias"))
        aka = [alias] if alias and alias != name else []
        leads.append(
            make_lead(
                source="city_gardens",
                source_url=GARDENS_URL,
                native_id=native_id,
                name=name,
                aka=aka,
                kind_hint="garden",
                description=clean_text(a.get("garden_description")),
                website=clean_text(a.get("contact_website")),
                email=clean_text(a.get("contact_email")),
                address=clean_text(a.get("address")),
                city=clean_text(a.get("city")) or "Philadelphia",
                zip=clean_zip(a.get("zip_code")),
                lat=lat,
                lng=lng,
                schedule_text=_garden_schedule_text(a),
                tags_hint=["Registered Community Garden"],
                extra={
                    "park_name": a.get("park_name"),
                    "garden_status": a.get("garden_status"),
                    "ppr_land": a.get("ppr_land"),
                    "council_district": a.get("council_district"),
                    "comments": a.get("comments"),
                },
            )
        )
    return leads


def parse_libraries(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = str(a.get("FID"))
        lat = a.get("Lattitude")
        lng = a.get("Longitude")
        leads.append(
            make_lead(
                source="city_libraries",
                source_url=LIBRARIES_URL,
                native_id=native_id,
                name=clean_text(a.get("Branch")) or "Unknown branch",
                kind_hint="facility",
                address=clean_text(a.get("Street_Address")),
                city=clean_text(a.get("City")) or "Philadelphia",
                zip=clean_zip(a.get("Zip_Code")),
                lat=lat,
                lng=lng,
                tags_hint=["Free Library of Philadelphia branch"],
            )
        )
    return leads


def parse_rec_centers(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = str(a.get("OBJECTID") or a.get("FID"))
        lat, lng = polygon_centroid(feat)
        name = clean_text(a.get("ASSET_NAME")) or clean_text(a.get("SITE_NAME")) or "Unknown site"
        leads.append(
            make_lead(
                source="city_rec",
                source_url=REC_CENTERS_URL,
                native_id=native_id,
                name=name,
                kind_hint="facility",
                address=clean_text(a.get("ADDRESS")),
                city="Philadelphia",
                zip=clean_zip(a.get("ZIPCODE")),
                lat=lat,
                lng=lng,
                tags_hint=[t for t in (clean_text(a.get("TYPE")), clean_text(a.get("USE_"))) if t],
                extra={
                    "site_name": a.get("SITE_NAME"),
                    "child_of": a.get("CHILD_OF"),
                    "occupant": a.get("OCCUPANT"),
                    "tenant": a.get("TENANT"),
                    "label": a.get("LABEL"),
                    "chronology": a.get("CHRONOLOGY"),
                },
            )
        )
    return leads


def parse_senior_pca(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = f"pca:{a.get('ObjectId')}"
        lat, lng = point_latlng(feat)
        leads.append(
            make_lead(
                source="city_senior",
                source_url=PCA_SENIOR_URL,
                native_id=native_id,
                name=clean_text(a.get("Name")) or "Unknown senior center",
                kind_hint="facility",
                phone=clean_text(a.get("Phone_Number")),
                address=clean_text(a.get("Address")),
                city="Philadelphia",
                zip=clean_zip(a.get("Zipcode")),
                lat=lat,
                lng=lng,
                schedule_text=clean_text(a.get("Hours")),
                tags_hint=["PCA senior center"],
                extra={"list": "PCA_SeniorCenters"},
            )
        )
    return leads


def parse_senior_sites(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for feat in features:
        a = feat["attributes"]
        native_id = f"sites:{a.get('OBJECTID')}"
        lat, lng = point_latlng(feat)
        leads.append(
            make_lead(
                source="city_senior",
                source_url=SENIOR_SITES_URL,
                native_id=native_id,
                name=clean_text(a.get("site_name")) or "Unknown senior site",
                kind_hint="facility",
                phone=clean_text(a.get("phone_number")),
                address=clean_text(a.get("address")),
                city="Philadelphia",
                zip=clean_zip(a.get("zip_code")),
                lat=lat,
                lng=lng,
                tags_hint=["Senior_Sites_PUBLIC_VIEW"],
                extra={"list": "Senior_Sites_PUBLIC_VIEW", "status": a.get("Status")},
            )
        )
    return leads


# --------------------------------------------------------------------------------------
# harvest entry points (network + parse)
# --------------------------------------------------------------------------------------


def harvest_city_rco(client: FyjClient) -> list[dict[str, Any]]:
    return parse_zoning_rco(fetch_all_features(client, ZONING_RCO_URL))


def harvest_city_rco_points(client: FyjClient) -> list[dict[str, Any]]:
    return parse_rco_points(fetch_all_features(client, RCO_POINTS_URL))


def harvest_city_friends(client: FyjClient) -> list[dict[str, Any]]:
    return parse_ppr_friends(fetch_all_features(client, PPR_FRIENDS_URL))


def harvest_city_nac(client: FyjClient) -> list[dict[str, Any]]:
    return parse_nac(fetch_all_features(client, NAC_URL))


def harvest_city_gardens(client: FyjClient) -> list[dict[str, Any]]:
    return parse_gardens(fetch_all_features(client, GARDENS_URL))


def harvest_city_libraries(client: FyjClient) -> list[dict[str, Any]]:
    return parse_libraries(fetch_all_features(client, LIBRARIES_URL))


def harvest_city_rec(client: FyjClient) -> list[dict[str, Any]]:
    return parse_rec_centers(fetch_all_features(client, REC_CENTERS_URL))


def harvest_city_senior(client: FyjClient) -> list[dict[str, Any]]:
    pca = parse_senior_pca(fetch_all_features(client, PCA_SENIOR_URL))
    sites = parse_senior_sites(fetch_all_features(client, SENIOR_SITES_URL))
    return pca + sites
