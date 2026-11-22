#!/usr/bin/env python3
"""Edge-case gate.

  python3 scripts/check_matrix.py --sync     add any new ids from references/edge-cases.md to the matrix
  python3 scripts/check_matrix.py            fail if a P0 case has no test or is not passing

Matrix columns: id,priority,area,title,test,status   (status: todo | written | passing | n/a)
"""
import csv
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG = ROOT / "references" / "edge-cases.md"
MATRIX = ROOT / "templates" / "edge-case-matrix.csv"
FIELDS = ["id", "priority", "area", "title", "test", "status"]
ROW = re.compile(r"^- \*\*([A-Z]{2,3}-\d{2}) \((P[012])\) ([^*]+?)\*\*")


def catalog():
    area = ""
    for line in CATALOG.read_text().splitlines():
        if line.startswith("## "):
            area = re.sub(r"^## \d+\. ", "", line).split(" (")[0]
        m = ROW.match(line)
        if m:
            yield {"id": m[1], "priority": m[2], "area": area, "title": m[3].rstrip("."), "test": "", "status": "todo"}


def load():
    if not MATRIX.exists():
        return []
    with MATRIX.open(newline="") as f:
        return list(csv.DictReader(f))


def save(rows):
    with MATRIX.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    rows = load()
    if "--sync" in sys.argv:
        have = {r["id"] for r in rows}
        added = [c for c in catalog() if c["id"] not in have]
        save(rows + added)
        print(f"{len(added)} new case(s) added; {len(rows) + len(added)} in the matrix")
        return 0
    missing = [r for r in rows if r["priority"] == "P0" and r["status"] not in ("passing", "n/a")]
    by_p = {p: sum(1 for r in rows if r["priority"] == p) for p in ("P0", "P1", "P2")}
    print(f"{len(rows)} cases (P0 {by_p['P0']}, P1 {by_p['P1']}, P2 {by_p['P2']}); "
          f"passing {sum(1 for r in rows if r['status'] == 'passing')}")
    if missing:
        print(f"{len(missing)} P0 case(s) without a passing test:")
        for r in missing[:50]:
            print(f"  {r['id']}  {r['title']}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
