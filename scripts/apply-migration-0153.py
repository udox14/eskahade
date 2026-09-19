"""Script to apply migration 0153 to Cloudflare D1 remote database with retries."""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_FILE = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"


def split_sql_statements(sql_text: str) -> list[str]:
    statements = []
    current = []
    in_trigger = False
    for line in sql_text.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("--"):
            continue
        if "CREATE TRIGGER" in trimmed.upper():
            in_trigger = True
        current.append(line)
        if in_trigger:
            if trimmed.upper().endswith("END;"):
                stmt = "\n".join(current).strip()
                if stmt:
                    statements.append(stmt)
                current = []
                in_trigger = False
        elif trimmed.endswith(";"):
            stmt = "\n".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
    if current:
        stmt = "\n".join(current).strip()
        if stmt:
            statements.append(stmt)
    return statements


def main() -> None:
    content = MIGRATION_FILE.read_text(encoding="utf-8")
    statements = split_sql_statements(content)
    print(f"Found {len(statements)} statements to execute.")

    for i, stmt in enumerate(statements, 1):
        one_liner = " ".join(stmt.split())
        display_name = one_liner[:60] + "..." if len(one_liner) > 60 else one_liner
        print(f"[{i}/{len(statements)}] Executing: {display_name}")

        cmd = [
            "npx.cmd",
            "wrangler",
            "d1",
            "execute",
            "eskahade-db",
            "--remote",
            f"--command={one_liner}",
        ]

        max_retries = 3
        success = False
        for attempt in range(1, max_retries + 1):
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                cwd=str(ROOT),
            )
            if result.returncode == 0:
                print("  -> OK")
                success = True
                break
            else:
                if attempt < max_retries and "fetch failed" in (result.stderr + result.stdout):
                    print(f"  -> Transient fetch error, retrying attempt {attempt + 1}/{max_retries}...")
                    time.sleep(2)
                else:
                    safe_err = result.stderr.encode("ascii", errors="replace").decode("ascii")
                    safe_out = result.stdout.encode("ascii", errors="replace").decode("ascii")
                    print(f"FAILED on statement {i}:\nERR: {safe_err}\nOUT: {safe_out}")
                    sys.exit(1)

    print("\nAll statements in migration 0153 executed successfully on remote D1.")


if __name__ == "__main__":
    main()
