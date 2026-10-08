"""Shared filesystem locations for the pipeline.

Everything here is resolved relative to the repository root, so the pipeline works the same
whether it is run from the repo root, from inside pipeline/, or installed with `pip install -e`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
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


def _env_path(name: str) -> Path | None:
    raw = os.environ.get(name)
    return Path(raw).expanduser() if raw else None


@dataclass(frozen=True)
class Layout:
    """Every repository location the group pipeline reads or writes, under one root.

    The commands take a Layout so tests can point them at a temporary directory, and so the
    orchestrator can run them against another worktree with FYJ_ROOT. FYJ_VOCAB_DIR overrides
    only the vocabulary folder (useful while the vocabulary branch has not been merged yet).
    """

    root: Path
    vocab_override: Path | None = None

    @property
    def groups_dir(self) -> Path:
        return self.root / "data" / "groups"

    @property
    def lock_path(self) -> Path:
        return self.groups_dir / ".lock"

    @property
    def leads_dir(self) -> Path:
        return self.root / "data" / "leads"

    @property
    def vocab_dir(self) -> Path:
        return self.vocab_override or (self.root / "data" / "vocab")

    @property
    def triage_path(self) -> Path:
        return self.root / "data" / "triage.jsonl"

    @property
    def blocklist_path(self) -> Path:
        return self.root / "data" / "blocklist.yaml"

    @property
    def liveness_path(self) -> Path:
        return self.root / "data" / "liveness.jsonl"

    @property
    def geo_dir(self) -> Path:
        return self.root / "data" / "geo"

    @property
    def planning_districts_path(self) -> Path:
        return self.geo_dir / "planning_districts.geojson"

    @property
    def seeds_dir(self) -> Path:
        return self.root / "data" / "seeds"

    @property
    def registry_path(self) -> Path:
        return self.root / "registry" / "sources.yaml"

    @property
    def research_dir(self) -> Path:
        return self.root / "research"

    def inbox_dir(self, wave: str) -> Path:
        return self.research_dir / "inbox" / wave

    def done_dir(self, wave: str) -> Path:
        return self.research_dir / "done" / wave

    def held_dir(self, wave: str) -> Path:
        return self.research_dir / "held" / wave

    def batches_dir(self, wave: str) -> Path:
        return self.research_dir / "batches" / wave

    @property
    def checks_dir(self) -> Path:
        return self.research_dir / "checks"

    @property
    def coverage_dir(self) -> Path:
        return self.research_dir / "coverage"

    @property
    def site_data_dir(self) -> Path:
        return self.root / "site" / "public" / "data"


def default_layout() -> Layout:
    return Layout(root=_env_path("FYJ_ROOT") or ROOT_DIR, vocab_override=_env_path("FYJ_VOCAB_DIR"))
