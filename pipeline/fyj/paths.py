"""Shared filesystem locations for the pipeline.

Everything here is resolved relative to the repository root, so the pipeline works the same
whether it is run from the repo root, from inside pipeline/, or installed with `pip install -e`.
"""

from __future__ import annotations

import os
from pathlib import Path

# pipeline/fyj/paths.py -> pipeline/fyj -> pipeline -> repo root
ROOT_DIR = Path(__file__).resolve().parents[2]

REGISTRY_PATH = ROOT_DIR / "registry" / "sources.yaml"
LEADS_DIR = ROOT_DIR / "data" / "leads"
SEEDS_DIR = ROOT_DIR / "data" / "seeds"
MANUAL_SEEDS_PATH = SEEDS_DIR / "manual.yaml"
CITY_PROGRAMS_PATH = SEEDS_DIR / "city_programs.yaml"


def cache_dir() -> Path:
    """Where raw downloads are cached. Shared across worktrees, never committed."""
    raw = os.environ.get("FYJ_CACHE")
    if raw:
        return Path(raw).expanduser()
    return Path("~/.cache/find-your-jawn").expanduser()


def leads_path(source_id: str) -> Path:
    return LEADS_DIR / f"{source_id}.jsonl"
