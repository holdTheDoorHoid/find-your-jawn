"""Loads registry/sources.yaml, the sources contract described in docs/DATA_MODEL.md section 1."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from fyj.paths import REGISTRY_PATH

REQUIRED_KEYS = (
    "id",
    "name",
    "owner",
    "url",
    "access",
    "terms",
    "attribution",
    "lead_only",
    "refresh",
    "harvester",
    "notes",
)


@dataclass
class Source:
    id: str
    name: str
    owner: str
    url: str
    access: str
    terms: str
    attribution: str
    lead_only: bool
    refresh: str
    harvester: str
    notes: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Source:
        return cls(**{k: data.get(k) for k in REQUIRED_KEYS})


def load_sources(path: Path = REGISTRY_PATH) -> list[Source]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or []
    return [Source.from_dict(entry) for entry in raw]


def load_source(source_id: str, path: Path = REGISTRY_PATH) -> Source | None:
    for source in load_sources(path):
        if source.id == source_id:
            return source
    return None
