#!/usr/bin/env bash
set -euo pipefail

PSQL="/opt/homebrew/opt/postgresql@16/bin/psql"
DB="roar_assessment"
PORT=5432
SCHEMA="app"
CORE_DIR="$HOME/Downloads/roar-assessment-dev"

TABLES=(
  runs
  run_trials
  run_trial_interactions
  run_scores
)

echo "Starting assessment database data load..."

# 0) Optional: attempt to bypass FK checks (works only if permitted)
$PSQL -p "$PORT" -d "$DB" -v ON_ERROR_STOP=1 -c "BEGIN; SET LOCAL session_replication_role = 'replica'; COMMIT;" \
  >/dev/null 2>&1 || echo "NOTE: cannot set session_replication_role=replica (not superuser). Continuing."

# 1) Truncate all app tables (single statement is best)
echo "Truncating existing tables..."
$PSQL -p "$PORT" -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE stmt text;
BEGIN
  SELECT 'TRUNCATE TABLE ' ||
         string_agg(format('%I.%I', schemaname, tablename), ', ') ||
         ' RESTART IDENTITY CASCADE;'
    INTO stmt
  FROM pg_tables
  WHERE schemaname = 'app';

  IF stmt IS NULL THEN
    RAISE EXCEPTION 'No tables found in schema app';
  END IF;

  EXECUTE stmt;
END $$;
SQL

# 2) Import each mapped table, filtering generated/identity-always columns out of the CSV
for tbl in "${TABLES[@]}"; do
  f="$CORE_DIR/$tbl.csv"
  if [[ ! -f "$f" ]]; then
    echo "Skipping $tbl (no CSV at $f)"
    continue
  fi

  echo "Importing $SCHEMA.$tbl"

  cols_csv="$($PSQL -p "$PORT" -d "$DB" -At -v ON_ERROR_STOP=1 <<SQL
SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
FROM information_schema.columns
WHERE table_schema = '$SCHEMA'
  AND table_name = '$tbl'
  AND is_generated = 'NEVER'
  AND NOT (is_identity='YES' AND identity_generation='ALWAYS');
SQL
)"

  if [[ -z "${cols_csv// }" ]]; then
    echo "  -> ERROR: couldn't find insertable columns for $SCHEMA.$tbl"
    exit 1
  fi

  tmp="$(mktemp "/tmp/${tbl}.XXXXXX.csv")"

  python3 - "$f" "$tmp" "$cols_csv" <<'PY'
import csv, sys
src, dst, cols_csv = sys.argv[1], sys.argv[2], sys.argv[3]
keep = [c.strip().strip('"') for c in cols_csv.split(",")]

with open(src, newline="") as fin:
    r = csv.DictReader(fin)
    if r.fieldnames is None:
        raise SystemExit("CSV has no header row (expected HEADER true)")

    missing = [c for c in keep if c not in r.fieldnames]
    if missing:
        raise SystemExit(f"CSV missing columns {missing}\nHeader={r.fieldnames}")

    with open(dst, "w", newline="") as fout:
        w = csv.DictWriter(fout, fieldnames=keep, extrasaction="ignore")
        w.writeheader()
        for row in r:
            w.writerow({k: row.get(k, "") for k in keep})
PY

  $PSQL -p "$PORT" -d "$DB" -v ON_ERROR_STOP=1 \
    -c "\copy $SCHEMA.\"$tbl\"($cols_csv) FROM '$tmp' WITH (FORMAT csv, HEADER true, NULL '')"

  rm -f "$tmp"
done

echo "Assessment database data load complete!"
