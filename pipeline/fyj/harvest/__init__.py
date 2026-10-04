"""Registry of harvester ids to their entry point functions.

Every id here must also have a matching entry in registry/sources.yaml. A harvester function
takes the shared FyjClient and returns a list of lead dicts; it does not write files itself.

This starts empty and gains one line per harvester as each is added, commit by commit.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fyj.http import FyjClient

HarvestFn = Callable[[FyjClient], list[dict[str, Any]]]

HARVESTERS: dict[str, HarvestFn] = {}
