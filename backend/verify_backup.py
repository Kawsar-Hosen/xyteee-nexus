"""Verify a generated Nexus backup before restore.

With per-row INSERT statements this is straightforward:
  - every non-comment line is exactly one INSERT INTO <t> ... VALUES (...);
  - value-count in each tuple == column-count for that table
  - row counts per table match the <table>.json files
  - restore_schema.sql has exactly one CREATE TABLE per SCHEMA table

Run: python3 verify_backup.py <backup_dir>
"""

import json
import re
import sys
from pathlib import Path


def split_values(tup: str) -> list[str]:
    res, cur, in_sq, i = [], [], False, 0
    while i < len(tup):
        ch = tup[i]
        if ch == "'":
            if not in_sq:
                in_sq = True
            elif i + 1 < len(tup) and tup[i + 1] == "'":
                cur.append("''")
                i += 1
                i += 1
                continue
            else:
                in_sq = False
        elif ch == "," and not in_sq:
            res.append("".join(cur).strip())
            cur = []
            i += 1
            continue
        cur.append(ch)
        i += 1
    res.append("".join(cur).strip())
    return res


def split_statements(text: str) -> list[str]:
    """Split SQL on ';' that are outside single-quoted strings."""
    res, cur, in_sq, i = [], [], False, 0
    while i < len(text):
        ch = text[i]
        if ch == "'":
            if not in_sq:
                in_sq = True
            elif i + 1 < len(text) and text[i + 1] == "'":
                cur.append("''")
                i += 1
                i += 1
                continue
            else:
                in_sq = False
        elif ch == ";" and not in_sq:
            res.append("".join(cur))
            cur = []
            i += 1
            continue
        cur.append(ch)
        i += 1
    res.append("".join(cur))
    return [s.strip() for s in res if s.strip()]


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: verify_backup.py <backup_dir>")
        sys.exit(1)
    d = Path(sys.argv[1])
    data = d / "restore_data.sql"
    schema = d / "restore_schema.sql"

    spec = Path(__file__).resolve().parent / "backup_supabase.py"
    m = re.search(r"SCHEMA: dict\[str, dict\[str, str\]\] = (\{.*?\n\})", spec.read_text(), re.S)
    schema_dict = eval(m.group(1))
    serial = {"user_sessions": {"id"}, "blocks": {"id"}}

    errors: list[str] = []
    rows_by_table: dict[str, int] = {}
    total = 0

    text = data.read_text()
    stmts = [re.sub(r"^\s*--.*$", "", s, flags=re.M).strip() for s in split_statements(text)]
    stmts = [s for s in stmts if s]

    for i, stmt in enumerate(stmts, 1):
        m = re.match(
            r"INSERT INTO (\w+) \(([^)]*)\) VALUES \((.*)\)$", stmt, re.S
        )
        if not m:
            errors.append(f"data.sql stmt {i}: unrecognised: {stmt[:80]}")
            continue
        table, cols_s, vals_s = m.group(1), m.group(2), m.group(3)
        cols = [c.strip().strip('"') for c in cols_s.split(",")]
        expect = len([c for c in schema_dict[table] if c not in serial.get(table, set())])
        nvals = len(split_values(vals_s))
        if len(cols) != expect:
            errors.append(f"{table}: {len(cols)} columns listed, expect {expect}")
        if nvals != expect:
            errors.append(f"{table}: {nvals} values vs {expect} columns")
        rows_by_table[table] = rows_by_table.get(table, 0) + 1
        total += 1

    # every json file row must be represented
    for t in schema_dict:
        j = d / f"{t}.json"
        if not j.exists():
            errors.append(f"{t}: missing {t}.json")
            continue
        n_json = len(json.loads(j.read_text()))
        n_sql = rows_by_table.get(t, 0)
        if n_json != n_sql:
            errors.append(f"{t}: json={n_json} rows, sql={n_sql}")

    creates = re.findall(r"CREATE TABLE (\w+)", schema.read_text())
    for t in schema_dict:
        if creates.count(t) != 1:
            errors.append(f"schema: CREATE TABLE {t} count={creates.count(t)}")

    if errors:
        print("❌ FAILED")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    print(f"✅ OK — {total} rows across {len(rows_by_table)} tables; "
          f"{len(creates)} CREATE TABLE statements; every INSERT matches its columns.")


if __name__ == "__main__":
    main()
