"""Registry of harvester ids to their entry point functions.

Every id here must also have a matching entry in registry/sources.yaml. A harvester function
takes the shared FyjClient and returns a list of lead dicts; it does not write files itself.

This starts empty and gains one line per harvester as each is added, commit by commit.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fyj.http import FyjClient

from . import (
    arcgis,
    campus_labs,
    city_programs,
    city_volunteer_pages,
    city_volunteer_portal,
    cultural_fund,
    irs_990n,
    irs_bmf,
    manual_seeds,
    mummers,
    nss_grottos,
    penn_clubs,
)

# Registry entries that feed reference data rather than leads. They have no harvester function and
# no leads file; fyj.geo reads planning_districts.
REFERENCE_SOURCES = {"planning_districts"}

HarvestFn = Callable[[FyjClient], list[dict[str, Any]]]

HARVESTERS: dict[str, HarvestFn] = {
    "city_rco": arcgis.harvest_city_rco,
    "city_rco_points": arcgis.harvest_city_rco_points,
    "city_friends": arcgis.harvest_city_friends,
    "city_nac": arcgis.harvest_city_nac,
    "city_gardens": arcgis.harvest_city_gardens,
    "city_libraries": arcgis.harvest_city_libraries,
    "city_rec": arcgis.harvest_city_rec,
    "city_senior": arcgis.harvest_city_senior,
    "irs_bmf": irs_bmf.harvest,
    "irs_990n": irs_990n.harvest,
    "penn_clubs": penn_clubs.harvest,
    "engage_drexel": campus_labs.harvest_drexel,
    "engage_ccp": campus_labs.harvest_ccp,
    "cultural_fund": cultural_fund.harvest,
    "mummers": mummers.harvest,
    "nss_grottos": nss_grottos.harvest,
    "manual_seeds": manual_seeds.harvest,
    "city_volunteer_portal": city_volunteer_portal.harvest,
    "city_volunteer_pages": city_volunteer_pages.harvest,
    "city_programs": city_programs.harvest,
}
