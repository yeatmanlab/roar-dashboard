## Internationalization (i18n) and Crowdin Integration

This dashboard uses Crowdin to manage translations. Locally, translations are maintained as consolidated multilingual CSVs and transformed at build time into per-locale JSON files consumed by the app.

### Objectives
- Single source of truth in Crowdin (multilingual CSVs)
- Automatic detection and inclusion of new locales
- Fast runtime (no CSV parsing in the browser)
- Deterministic build outputs and robust validation
- Simple E2E validation that each locale can log in and navigate

---

## Structure

- Crowdin config
  - [`src/translations/crowdin/crowdin.yml`](./crowdin/crowdin.yml)
- Consolidated CSVs (source-of-truth locally; mirrored to Crowdin)
  - [`src/translations/consolidated/dashboard-translations.csv`](./consolidated/dashboard-translations.csv)
  - [`src/translations/consolidated/components/*-translations.csv`](./consolidated/components/)
  - Columns: `identifier,label,en-US,es-CO,de,fr-CA,nl,en-GH,de-CH,es-AR`
- Build tools
  - [`src/translations/tools/create-consolidated-translations.js`](./tools/create-consolidated-translations.js) (optional local consolidation)
  - [`src/translations/tools/csv-to-json.js`](./tools/csv-to-json.js) (CSV → per-locale JSON; includes validation and caching)
  - [`src/translations/tools/download-and-rebuild.js`](./tools/download-and-rebuild.js) (Crowdin → local JSON; optional)
  - [`src/translations/tools/validate-csvs.js`](./tools/validate-csvs.js) (new: CSV validation across all files)
  - [`src/translations/tools/add-locale-column.js`](./tools/add-locale-column.js) (new: add locale columns to CSVs, optionally seeded)
- Runtime loading
  - [`src/translations/i18n.ts`](./i18n.ts)
    - Loads existing baseline locales and auto-imports any `**-componentTranslations.json`
    - Automatically registers new locales in `languageOptions`
- Generated per-locale files (output of CSV → JSON)
  - `src/translations/<lang>/<region?>/<locale>-componentTranslations.json`
  - Examples: `en/en-componentTranslations.json`, `es/co/es-co-componentTranslations.json`, `de/ch/de-ch-componentTranslations.json`

---

## Crowdin configuration

- Project: `levantetranslations` (ID: 756721)
- Destination in Crowdin: `main/dashboard/` folder (main + components subfolder)
- Each CSV is a multilingual spreadsheet with the columns listed above
- Fallback seeding in CSV generation:
  - `en-GH` seeded from `en`
  - `de-CH` seeded from `de`
  - `es-AR` seeded from `es-CO`

---

## Scripts and workflow

Key scripts (see [`package.json`](../../package.json)):

- Build-time utilities
  - `npm run i18n:consolidate`
    - Optional: regenerate consolidated CSVs from legacy JSON
    - Deterministic: rows sorted by identifier for stable diffs
  - `npm run i18n:crowdin:upload`
    - Upload CSVs to Crowdin
  - `npm run i18n:crowdin:download`
    - Download latest translations from Crowdin
  - `npm run i18n:csv-to-json`
    - Transform consolidated CSVs into per-locale JSON files
    - Validates basic CSV requirements and duplicates per file
    - Skips writing unchanged JSON (faster incremental builds)
  - `npm run i18n:validate` (new)
    - Validates all consolidated CSVs across files:
      - Required columns present (`identifier`, `label`)
      - No empty or duplicate identifiers across all files
      - Coverage report per locale (non-empty vs total)
    - Optional gate: set `I18N_FAIL_ON_LOW_COVERAGE=TRUE` with `I18N_COVERAGE_THRESHOLD=<percent>`
  - `npm run i18n:add-locale` (new)
    - Adds a new locale column to every consolidated CSV
    - Usage:
      - `I18N_NEW_LOCALE=it npm run i18n:add-locale`
      - `I18N_NEW_LOCALE=pt-BR I18N_SEED_FROM=es-CO npm run i18n:add-locale`
  - `npm run i18n:sync`
    - `consolidate → upload → download → csv-to-json → validate`

- Dev/build hooks
  - `predev` / `prebuild`:
    - If `CROWDIN_API_TOKEN` is set: run `i18n:crowdin:download`
    - Always run `i18n:csv-to-json` to ensure per-locale JSON exists

Environment variables:
- `CROWDIN_API_TOKEN` for Crowdin upload/download
- `I18N_NEW_LOCALE`, `I18N_SEED_FROM` for `i18n:add-locale`
- `I18N_FAIL_ON_LOW_COVERAGE`, `I18N_COVERAGE_THRESHOLD` for `i18n:validate`

Notes:
- Crowdin steps are optional during dev; without `CROWDIN_API_TOKEN` the app uses local CSVs

---

## Adding a new locale

1. Add a column to each CSV:
   - `I18N_NEW_LOCALE=<locale> [I18N_SEED_FROM=<base>] npm run i18n:add-locale`
2. Upload sources to Crowdin:
   - `npm run i18n:crowdin:upload`
3. Translators update strings in Crowdin
4. Pull updates and generate JSON:
   - `npm run i18n:crowdin:download && npm run i18n:csv-to-json`

The CSV → JSON step will detect the new locale, create the appropriate directory structure under `src/translations/`, and emit `<locale>-componentTranslations.json`. `i18n.ts` will auto-import and register it at runtime.

---

## Adding new terms (strings)

When you need a new UI term translated:

- Edit the appropriate consolidated CSV under `src/translations/consolidated/` (main dashboard or a file in `consolidated/components/`).
- Add a new row with only the source fields filled:
  - `identifier`: unique key (e.g., `navBar.invite`)
  - `label`: short description for translators
  - `en-US`: source English text
- Leave all target language cells blank, but keep the commas so the row has the same number of columns as the header.

Example (only source provided):
```csv
"identifier","label","en-US","es-CO","de","fr-CA","nl","en-GH","de-CH","es-AR"
"navBar.invite","Invite button label","Invite","","","","","","",""
```

Notes:
- Keep fields quoted if they may contain commas or special characters.
- Crowdin will populate target languages (via translators/MT/TM). Our validator allows empty targets unless `I18N_FAIL_ON_LOW_COVERAGE=TRUE` is set.
- Do not edit the generated per-locale JSON files directly; they are overwritten by `npm run i18n:csv-to-json` and Crowdin sync.

Workflow after adding rows:
```bash
npm run i18n:crowdin:upload   # optional; pushes sources to Crowdin
npm run i18n:crowdin:download # pull updated CSVs when translations are ready
npm run i18n:csv-to-json      # regenerate per-locale JSON for the app
```

Then run the app and verify in different locales:
```bash
npm run dev:db
```

---

## Runtime i18n

- `src/translations/i18n.ts` builds base messages and merges any detected `**-componentTranslations.json`
- New locales are auto-registered in `languageOptions` with a best-effort display name via `Intl.DisplayNames`
- To constrain what appears in the UI selector, filter `languageOptions` as needed

---

## Cypress validation

Two specs:
- [`cypress/e2e/testTasks.cy.ts`](../../cypress/e2e/testTasks.cy.ts)
  - Participant dashboard flow (requires a participant account)
- [`cypress/e2e/locales.cy.ts`](../../cypress/e2e/locales.cy.ts)
  - Iterates through locales: `en, en-US, es, es-CO, de, fr-CA, nl, en-GH, de-CH, es-AR`
  - Sets the locale pre-load, logs in, and asserts navigation away from `/signin`

Env for tests (via shell or `cypress.env.json`):
- `E2E_USE_ENV=TRUE` to enable env overrides
- `E2E_BASE_URL="https://localhost:5173/signin"`
- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- Optional: `E2E_LOCALES="en,es,de"` to subset

Example `cypress.env.json`:
```json
{
  "E2E_USE_ENV": "TRUE",
  "E2E_BASE_URL": "https://localhost:5173/signin",
  "E2E_TEST_EMAIL": "oscar@cardinalfamily.com",
  "E2E_TEST_PASSWORD": "admin123"
}
```

Run headless with seeded users:
```bash
# Optional: provide admin credentials for firebase-admin seeding
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json

npm run dev

E2E_USE_ENV=TRUE \
E2E_BASE_URL="https://localhost:5173/signin" \
E2E_TEST_EMAIL="oscar@cardinalfamily.com" \
E2E_TEST_PASSWORD="admin123" \
npm run cypress:run-seeded
```

Implementation details to reduce flakiness:
- Input fields are typed using `{selectall}{backspace}` + `.type()` (no `clear()`) to avoid detachment on re-renders
- Buttons are re-queried with `.first()` before clicking

---

## Seeding DEV users

Scripts (in [`scripts/`](../../scripts/)):
- [`seed-dev-user-admin.js`](../../scripts/seed-dev-user-admin.js): uses `firebase-admin` to upsert `users/<uid>` (preferred)
  - Requires `FIREBASE_ADMIN_CREDENTIALS` (inline JSON) or `GOOGLE_APPLICATION_CREDENTIALS` (file path)
- [`seed-dev-user.js`](../../scripts/seed-dev-user.js): client sign-in to obtain ID token and write the Firestore doc via REST
- [`seed-dev-participant.js`](../../scripts/seed-dev-participant.js): sign-up-or-sign-in a participant, then upsert the user doc

Convenience:
- `npm run cypress:run-seeded` tries admin seed, then client seed, then participant seed, then runs Cypress

Defaults (override via env):
- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- `E2E_FIREBASE_PROJECT_ID` (default: `hs-levante-admin-dev`)
- `E2E_FIREBASE_API_KEY` (default: DEV admin apiKey)

---

## CI workflow (GitHub Actions)

Workflow: [`.github/workflows/i18n-ci.yml`](../../.github/workflows/i18n-ci.yml)
- Node 20 LTS
- Steps:
  - Install deps
  - (Optional) `i18n:crowdin:download` if `CROWDIN_API_TOKEN` secret is provided
  - `i18n:csv-to-json`
  - `i18n:validate`
  - Typecheck and build
  - (Optional) Cypress locales smoke if `E2E_BASE_URL` is provided

Secrets/Env to configure in the repository:
- `CROWDIN_API_TOKEN` (optional for download in CI)
- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` for Cypress (optional)
- `E2E_BASE_URL` to enable Cypress step (e.g., a deployed preview URL)

---

## Developer environment

- Dev server (Vite)
  - HTTPS via `vite-plugin-mkcert`
  - Prefers port 5173 but will auto-switch if in use
- Node version
  - [`.nvmrc`](../../.nvmrc) recommends Node 20 LTS
  - Use `nvm use` to match CI and avoid npm warnings

---

## Troubleshooting

- Crowdin
  - Ensure `CROWDIN_API_TOKEN` is set for upload/download; otherwise, only local CSVs are used
- CSV validity failures
  - Check for missing `identifier`/`label`, duplicates across files, or malformed values
- Locale not visible
  - Ensure column exists in CSVs and re-run `i18n:csv-to-json`
  - Verify that `<locale>-componentTranslations.json` was generated
- Cypress detachment errors
  - Confirm tests use re-queries and `{selectall}{backspace}` before typing

---

## Translation Update Workflow (Crowdin → Dashboard)

This section documents the complete workflow for updating translations when they are modified in Crowdin. Based on recent fixes and learnings, here's the step-by-step process:

### Prerequisites
- Ensure you have `CROWDIN_API_TOKEN` environment variable set
- Node.js 20 LTS (use `nvm use` to match [`.nvmrc`](../../.nvmrc))
- Crowdin CLI installed (`npm install -g @crowdin/cli`)

### Step 1: Download Latest Translations from Crowdin
```bash
npm run i18n:crowdin:download
```
This downloads the latest translated CSVs from Crowdin to `src/translations/consolidated/`

### Step 2: Verify CSV Content
Check that the downloaded CSVs have the expected translations:
```bash
# Quick check - look at a few rows of the main dashboard CSV
head -5 src/translations/consolidated/dashboard-translations.csv

# Validate all CSVs for structural integrity
npm run i18n:validate
```

Expected CSV structure:
- Header: `identifier,label,en-US,es-CO,de,fr-CA,nl,en-GH,de-CH,es-AR`
- All language columns should have translated content (not empty strings)
- No duplicate identifiers across all CSV files

### Step 3: Generate JSON Files from CSVs
```bash
npm run i18n:csv-to-json
```
This converts the consolidated multilingual CSVs into per-locale JSON files under `src/translations/`

### Step 4: Verify Generated JSON Files
Check that the JSON files contain the expected translations:
```bash
# Verify a few key languages have content
head -15 src/translations/en/us/en-US-componentTranslations.json
head -15 src/translations/es/co/es-CO-componentTranslations.json
head -15 src/translations/de/de-componentTranslations.json
head -15 src/translations/nl/nl-componentTranslations.json
```

**⚠️ Important**: JSON files should NOT contain empty strings (`""`) for translated content. If they do, this indicates an issue with the CSV source data.

### Step 5: Test the Application
```bash
# Start development server
npm run dev:db

# Test different locales in the browser
# - Change language in the UI
# - Verify text appears in the correct language
# - Check for any translation keys showing instead of translated text
```

### Step 6: Run Automated Tests
```bash
# Run locale-specific Cypress tests
npm run cypress:run -- --spec "cypress/e2e/locales.cy.ts"

# Run full test suite
npm test
```

### Troubleshooting Common Issues

#### Issue 1: Empty Translations in JSON Files
**Symptoms**: JSON files contain empty strings (`""`) for translation values
**Root Cause**: CSV files downloaded from Crowdin are missing translations for certain languages
**Solution**: 
1. Check if the main CSV files in `src/translations/main/dashboard/` have the translations
2. If yes, copy them to consolidated: `cp -r src/translations/main/dashboard/* src/translations/consolidated/`
3. Re-run: `npm run i18n:csv-to-json`

#### Issue 2: Translation Keys Showing Instead of Text
**Symptoms**: UI shows `pageSignIn.login` instead of "Log in to access your dashboard"
**Root Cause**: Flat key structure doesn't match nested JSON structure
**Solution**: The system has automatic flat key mapping. Ensure `src/translations/i18n.ts` includes the `addFlatKeys` function.

#### Issue 3: New Languages Not Appearing
**Symptoms**: Added a new language in Crowdin but it doesn't show in the app
**Solution**:
1. Verify the language column exists in downloaded CSVs
2. Re-run `npm run i18n:csv-to-json` 
3. Check that `<locale>-componentTranslations.json` was generated
4. Restart the dev server

#### Issue 4: Consolidation Script Issues
**Symptoms**: `npm run i18n:consolidate` generates empty columns for some languages
**Root Cause**: The script tries to build from existing JSON files which may be empty
**Solution**: Only use consolidation script when you have authoritative data in legacy JSON format. Otherwise, work directly with the main CSVs as source of truth.

### Complete Sync Workflow
For a full sync from local changes through Crowdin and back:
```bash
# 1. If you have local changes to push to Crowdin
npm run i18n:consolidate  # Only if rebuilding from JSON sources
npm run i18n:crowdin:upload

# 2. Download latest from Crowdin and rebuild locally
npm run i18n:sync
# This runs: consolidate → upload → download → csv-to-json → validate
```

### File Structure Overview
```
src/translations/
├── main/dashboard/              # Source of truth CSVs (if not using Crowdin)
│   ├── dashboard-translations.csv
│   └── components/
│       ├── navbar-translations.csv
│       ├── game-tabs-translations.csv
│       └── ...
├── consolidated/                # Working CSVs (synced with Crowdin)
│   ├── dashboard-translations.csv
│   └── components/
│       ├── navbar-translations.csv
│       └── ...
├── en/us/                      # Generated JSON files
│   └── en-US-componentTranslations.json
├── es/co/
│   └── es-CO-componentTranslations.json
├── de/
│   └── de-componentTranslations.json
└── tools/                      # Build scripts
    ├── csv-to-json.js
    ├── download-and-rebuild.js
    └── ...
```

---

## Summary
- Authoritative strings are stored in multilingual CSVs and synced with Crowdin
- Build pipeline generates per-locale JSON for the app (fast runtime)
- New locales are detected and registered automatically
- Validation scripts and CI ensure quality and determinism
- Cypress tests provide a quick check that all locales can log in and navigate
- **Always verify CSV content before generating JSON files**
- **Main CSVs can serve as backup source of truth if Crowdin data is incomplete**
