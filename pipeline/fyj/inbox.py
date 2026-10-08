"""`fyj inbox-stats`: what research files are waiting, held or done."""

from __future__ import annotations

import json
from collections import Counter
from typing import Any

from fyj.paths import Layout


def _count_records(folder) -> tuple[int, Counter]:
    records = 0
    verdicts: Counter = Counter()
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        items = data if isinstance(data, list) else (data.get("records") or [])
        for item in items:
            if isinstance(item, dict):
                records += 1
                verdicts[str(item.get("verdict") or "?")] += 1
    return records, verdicts


def inbox_stats(layout: Layout) -> dict[str, Any]:
    stats: dict[str, Any] = {"waiting": {}, "held": {}, "done": {}}
    for key, base in (
        ("waiting", layout.research_dir / "inbox"),
        ("held", layout.research_dir / "held"),
        ("done", layout.research_dir / "done"),
    ):
        if not base.exists():
            continue
        for wave_dir in sorted(p for p in base.iterdir() if p.is_dir()):
            files = list(wave_dir.glob("*.json"))
            records, verdicts = _count_records(wave_dir)
            stats[key][wave_dir.name] = {
                "files": len(files),
                "records": records,
                "verdicts": dict(verdicts),
            }
    return stats


def format_inbox_stats(stats: dict[str, Any]) -> str:
    lines: list[str] = []
    titles = {"waiting": "Waiting to import", "held": "Held for repair", "done": "Already imported"}
    for key in ("waiting", "held", "done"):
        waves = stats[key]
        if not waves:
            lines.append(f"{titles[key]}: nothing")
            continue
        lines.append(f"{titles[key]}:")
        for wave, info in waves.items():
            verdicts = ", ".join(f"{v} {n}" for v, n in sorted(info["verdicts"].items()))
            lines.append(
                f"  {wave}: {info['files']} file(s), {info['records']} record(s)"
                + (f" ({verdicts})" if verdicts else "")
            )
    return "\n".join(lines)
