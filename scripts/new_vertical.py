#!/usr/bin/env python3
"""Scaffold a new vertical profile from templates/vertical-profile.json.

Usage: python3 scripts/new_vertical.py <key> [--name "Clinicpoint"] [--out verticals]
Writes verticals/<key>.json and prints the checklist of what to decide next.
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "vertical-profile.json"

CHECKLIST = [
    "Map primitives: item, modifier, table, tab, ticket, booking, guest (references/09-replicate.md, step 1)",
    "List genuinely new modules and keep the rest reused (step 2)",
    "Fill words; add protected tokens for tax names, headers and slugs (step 4)",
    "Trim modules to what this product sells; everything else is refused on the server",
    "Add itemFields and rules; add the vertical's edge cases to the matrix",
    "Create a demo tenant and an end-to-end script for this product",
    "Run the region checklist for every country you will sell it in (references/10-regions-tax.md)",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("--name", default="")
    ap.add_argument("--out", default="verticals")
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z][a-z0-9_]{1,20}", a.key):
        print("key must be lowercase letters, digits or _ (2 to 21 characters)", file=sys.stderr)
        return 2
    out_dir = pathlib.Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{a.key}.json"
    if target.exists():
        print(f"{target} already exists; not overwriting", file=sys.stderr)
        return 1
    profile = json.loads(TEMPLATE.read_text())
    profile["product"] = a.key
    profile["brand"]["name"] = a.name or a.key.capitalize() + "point"
    profile["demoTenant"] = f"demo-{a.key}"
    target.write_text(json.dumps(profile, indent=2) + "\n")
    print(f"Wrote {target}\n\nNext:")
    for i, step in enumerate(CHECKLIST, 1):
        print(f"  {i}. {step}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
