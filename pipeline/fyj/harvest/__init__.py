"""Registry of harvester ids to their entry point functions.

Every id here must also have a matching entry in registry/sources.yaml. A harvester function
takes the shared FyjClient and returns a list of lead dicts; it does not write files itself.

This starts empty and gains one line per harvester as each is added, commit by commit.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fyj.http import FyjClient

from . import arcgis

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
}
