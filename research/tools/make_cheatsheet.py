"""Write research/briefs/vocab-cheatsheet.md: every vocabulary id on as few lines as possible,
so Haiku research agents can classify groups without reading the full vocabulary files."""
import pathlib
import yaml

root = pathlib.Path(__file__).resolve().parents[2]
v = root / "data" / "vocab"
load = lambda n: yaml.safe_load((v / f"{n}.yaml").read_text())

out = ["# Vocabulary ids for research agents", "",
       "Generated from data/vocab by research/tools/make_cheatsheet.py. Use these ids exactly.", ""]

def ids(doc, key=None):
    items = doc if isinstance(doc, list) else doc.get(key) if key else next(x for x in doc.values() if isinstance(x, list))
    return [i["id"] for i in items]

kinds = load("kinds")
out += ["## kind", ", ".join(ids(kinds)), ""]
out += ["## categories (family id) and interests (tag ids under it)", ""]
for f in load("interests")["families"]:
    tags = ", ".join(t["id"] for t in f["tags"])
    note = " (support groups only)" if f.get("support_only") else ""
    out.append(f"- **{f['id']}**{note}: {tags}")
out.append("")
for name in ["motives", "formats", "roles"]:
    out += [f"## {name}", ", ".join(ids(load(name))), ""]
aud = load("audiences")
for key, val in aud.items():
    if isinstance(val, list) and val and isinstance(val[0], dict) and "id" in val[0]:
        out += [f"## audiences: {key}", ", ".join(i["id"] for i in val), ""]
out += ["In `audience.community` write heritage as `heritage:<id>` (e.g. `heritage:irish`) and languages as",
        "`language:<code>` (e.g. `language:es`). In `access.languages` write the bare code (`en`, `es`, `zh`, `vi`).", ""]
(root / "research" / "briefs" / "vocab-cheatsheet.md").write_text("\n".join(out))
print(len("\n".join(out)), "chars")
