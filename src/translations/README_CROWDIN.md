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

## Summary
- Authoritative strings are stored in multilingual CSVs and synced with Crowdin
- Build pipeline generates per-locale JSON for the app (fast runtime)
- New locales are detected and registered automatically
- Validation scripts and CI ensure quality and determinism
- Cypress tests provide a quick check that all locales can log in and navigate
