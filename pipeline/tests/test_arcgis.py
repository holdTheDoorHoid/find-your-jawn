import json

from fyj.harvest import arcgis


def _load(fixtures_dir, name):
    with open(fixtures_dir / name, encoding="utf-8") as f:
        return json.load(f)


def test_point_latlng_reads_wgs84_xy():
    feature = {"geometry": {"x": -75.18, "y": 39.92}}
    lat, lng = arcgis.point_latlng(feature)
    assert lat == 39.92
    assert lng == -75.18


def test_point_latlng_handles_missing_geometry():
    assert arcgis.point_latlng({}) == (None, None)


def test_polygon_centroid_averages_the_largest_ring():
    feature = {
        "geometry": {
            "rings": [
                [[0, 0], [0, 2], [2, 2], [2, 0]],
            ]
        }
    }
    lat, lng = arcgis.polygon_centroid(feature)
    assert lat == 1.0
    assert lng == 1.0


def test_find_zip_pulls_a_five_digit_zip_out_of_free_text():
    assert arcgis.find_zip("123 Main St, Philadelphia, PA 19130-4074") == "19130"
    assert arcgis.find_zip(None, "no zip here") is None


def test_parse_zoning_rco_from_fixture(fixtures_dir):
    data = _load(fixtures_dir, "arcgis_zoning_rco.json")
    leads = arcgis.parse_zoning_rco(data["features"])
    assert len(leads) == len(data["features"])
    lead = leads[0]
    assert lead["source"] == "city_rco"
    assert lead["kind_hint"] == "civic"
    assert lead["name"]
    assert lead["lead_id"].startswith("city_rco:")


def test_parse_ppr_friends_from_fixture(fixtures_dir):
    data = _load(fixtures_dir, "arcgis_ppr_friends.json")
    leads = arcgis.parse_ppr_friends(data["features"])
    assert len(leads) == len(data["features"])
    assert all(lead["kind_hint"] == "friends_group" for lead in leads)
    assert all(lead["zip"] is None or len(lead["zip"]) == 5 for lead in leads)


def test_parse_nac_from_fixture(fixtures_dir):
    data = _load(fixtures_dir, "arcgis_nac.json")
    leads = arcgis.parse_nac(data["features"])
    assert len(leads) == len(data["features"])
    assert all(lead["kind_hint"] == "civic" for lead in leads)


def test_parse_gardens_from_fixture(fixtures_dir):
    data = _load(fixtures_dir, "arcgis_gardens.json")
    leads = arcgis.parse_gardens(data["features"])
    assert len(leads) == len(data["features"])
    assert all(lead["kind_hint"] == "garden" for lead in leads)
    # the fixture's N/A hours should not show up as schedule_text
    for lead in leads:
        if lead["schedule_text"]:
            assert "N/A" not in lead["schedule_text"]


def test_parse_libraries_from_fixture(fixtures_dir):
    data = _load(fixtures_dir, "arcgis_libraries.json")
    leads = arcgis.parse_libraries(data["features"])
    assert len(leads) == len(data["features"])
    assert all(lead["kind_hint"] == "facility" for lead in leads)


def test_parse_rec_centers_from_fixture(fixtures_dir):
    data = _load(fixtures_dir, "arcgis_rec_centers.json")
    leads = arcgis.parse_rec_centers(data["features"])
    assert len(leads) == len(data["features"])
    assert all(lead["kind_hint"] == "facility" for lead in leads)


def test_parse_senior_pca_and_sites_use_prefixed_native_ids():
    pca_features = [
        {
            "attributes": {"Name": "Test Center", "Address": "1 Main St", "Zipcode": "19128",
                            "Phone_Number": "215-555-0100", "ObjectId": 1, "Hours": "9a to 5p"},
            "geometry": {"x": -75.2, "y": 40.0},
        }
    ]
    site_features = [
        {
            "attributes": {"OBJECTID": 1, "site_name": "Test Site", "address": "2 Main St",
                            "zip_code": 19134, "phone_number": "215-555-0101", "Status": "Active"},
            "geometry": {"x": -75.1, "y": 39.98},
        }
    ]
    pca_leads = arcgis.parse_senior_pca(pca_features)
    site_leads = arcgis.parse_senior_sites(site_features)
    assert pca_leads[0]["native_id"] == "pca:1"
    assert site_leads[0]["native_id"] == "sites:1"
    assert pca_leads[0]["lead_id"] != site_leads[0]["lead_id"]
    assert pca_leads[0]["kind_hint"] == site_leads[0]["kind_hint"] == "facility"


def test_parse_rco_points_uses_lni_id_when_present():
    features = [
        {
            "attributes": {
                "ORGANIZATI": "Test RCO",
                "ORGANIZA_1": "PO Box 1\r\nPhiladelphia, PA 19145",
                "PRIMARY_NA": "Jane Doe",
                "PRIMARY_EM": "jane@example.com",
                "PRIMARY_PH": "2155551234",
                "LNI_ID": 203,
                "OBJECTID": 1,
                "ORG_TYPE": "Other",
            },
            "geometry": {"x": -75.18, "y": 39.92},
        }
    ]
    leads = arcgis.parse_rco_points(features)
    assert leads[0]["native_id"] == "203"
    assert leads[0]["lead_id"] == "city_rco_points:203"
