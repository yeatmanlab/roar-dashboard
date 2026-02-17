# Database Data Loading Scripts

Scripts for loading CSV data into the ROAR PostgreSQL databases.

## Prerequisites

1. **PostgreSQL databases** must be running:
   - `roar_core` (port 5432)
   - `roar_assessment` (port 5432)

2. **CSV data directory** must exist at `~/roar-core-dev/` with the following CSV files:

   **Core database:**
   - users.csv
   - orgs.csv
   - classes.csv
   - groups.csv
   - families.csv
   - tasks.csv
   - task_variants.csv
   - task_variant_parameters.csv
   - task_bundles.csv
   - task_bundle_variants.csv
   - agreements.csv
   - administrations.csv
   - administration_orgs.csv
   - administration_classes.csv
   - administration_groups.csv
   - administration_task_variants.csv
   - administration_agreements.csv
   - user_orgs.csv
   - user_classes.csv
   - user_groups.csv
   - user_families.csv
   - rostering_runs.csv
   - rostering_run_entities.csv
   - rostering_provider_ids.csv
   - agreement_versions.csv
   - user_agreements.csv
   - invitation_codes.csv

   **Assessment database:**
   - runs.csv
   - run_trials.csv
   - run_interactions.csv
   - run_scores.csv

3. **Python 3** must be installed (for CSV processing)

4. **psql** command-line tool must be available

## Configuration

Edit the scripts to change these variables if needed:

```bash
DB="roar_core"           # Database name
PORT=5432                # PostgreSQL port
SCHEMA="app"             # Schema name
CORE_DIR="$HOME/roar-core-dev"  # Path to CSV files
```

## Usage

### Load All Data (Recommended)

This is the easiest way - loads both core and assessment databases:

```bash
./scripts/load-all-data.sh
```

This will:

1. Disable triggers for roar_core
2. Load core database data
3. Enable triggers for roar_core
4. Disable triggers for roar_assessment
5. Load assessment database data
6. Enable triggers for roar_assessment

### Load Individual Databases

**Load only core database:**

```bash
./scripts/disable-triggers.sh roar_core 5432
./scripts/load-core-data.sh
./scripts/enable-triggers.sh roar_core 5432
```

**Load only assessment database:**

```bash
./scripts/disable-triggers.sh roar_assessment 5432
./scripts/load-assessment-data.sh
./scripts/enable-triggers.sh roar_assessment 5432
```

### Trigger Management

**Disable triggers** (useful when loading data with FK constraints):

```bash
./scripts/disable-triggers.sh <database_name> <port>
```

**Enable triggers** (after data load):

```bash
./scripts/enable-triggers.sh <database_name> <port>
```

## How It Works

1. **Truncate tables**: Clears all existing data with `TRUNCATE ... CASCADE`
2. **Filter columns**: Automatically excludes generated/identity columns
3. **Process CSVs**: Python script filters CSV columns to match database schema
4. **Import data**: Uses PostgreSQL `\copy` command for efficient bulk loading
5. **Clean up**: Removes temporary files

## Troubleshooting

### "No CSV at path" warnings

- Some CSVs might be missing - this is OK, the script will skip them
- Make sure `CORE_DIR` points to the correct directory

### Foreign key constraint errors

- Make sure triggers are disabled before loading
- Check that CSV data has valid foreign key references
- Load order matters - parent tables must be loaded before child tables

### Permission errors

- You may need superuser privileges to disable triggers
- The script will continue even if it can't set `session_replication_role`

### Column mismatch errors

- CSV headers must match database column names exactly
- Generated columns are automatically excluded
- Check the error message for which columns are missing

## Notes

- ⚠️ **This will DELETE all existing data** in the target database
- The script uses `TRUNCATE ... CASCADE` which removes all data and resets sequences
- Triggers are temporarily disabled to avoid FK constraint issues during bulk loading
- The script is idempotent - you can run it multiple times safely
