## Internationalization (i18n) and Crowdin Integration

This project integrates with Crowdin to manage translations for the Levante Dashboard. Locally, we work with consolidated multilingual CSVs that are transformed at build-time into per-locale JSON files consumed by the app.

### Goals
- Single source of truth in Crowdin using multilingual CSVs
- Automatic addition of new locales from Crowdin without app code changes
- Fast runtime (no CSV parsing in the browser)
- Simple validation that each locale can boot the app and navigate post-signin

---

## File layout

- Crowdin config
  - `src/translations/crowdin/crowdin.yml`
- Consolidated CSVs (checked-in sources, pushed to Crowdin)
  - `src/translations/consolidated/dashboard-translations.csv`
  - `src/translations/consolidated/components/*-translations.csv`
  - CSV columns: `identifier,label,en,es-CO,de,fr-CA,nl,en-GH,de-CH,es-AR`
- Build tools
  - `src/translations/tools/create-consolidated-translations.js` (optional local consolidation)
  - `src/translations/tools/csv-to-json.js` (CSV → per-locale JSON)
  - `src/translations/tools/download-and-rebuild.js` (Crowdin → local JSON; optional)
- Runtime loading
  - `src/translations/i18n.ts`
    - Loads existing baseline locales and auto-imports any `**-componentTranslations.json`
    - Automatically registers new locales in `languageOptions`
- Generated per-locale files (output of CSV → JSON step)
  - `src/translations/<lang>/<region?>/<locale>-componentTranslations.json`
  - Examples:
    - `src/translations/en/en-componentTranslations.json`
    - `src/translations/en/us/en-us-componentTranslations.json`
    - `src/translations/es/co/es-co-componentTranslations.json`
    - `src/translations/de/ch/de-ch-componentTranslations.json`

---

## Crowdin configuration

- Project: `levantetranslations` (ID: 756721)
- Config: `src/translations/crowdin/crowdin.yml`
- Files are uploaded under `dashboard/`:
  - `dashboard/dashboard-translations.csv`
  - `dashboard/components/<component>-translations.csv`
- Each CSV is configured as a multilingual spreadsheet:
  - Columns: `identifier,label,en,es-CO,de,fr-CA,nl,en-GH,de-CH,es-AR`
  - Fallback seeding in generation:
    - `en-GH` seeded from `en`
    - `de-CH` seeded from `de`
    - `es-AR` seeded from `es-CO`

---

## Scripts and workflow

Available scripts (see `package.json`):

- Build-time utilities
  - `npm run i18n:consolidate`
    - Optional: regenerate consolidated CSVs from legacy JSON
  - `npm run i18n:crowdin:upload`
    - Upload CSVs to Crowdin
  - `npm run i18n:crowdin:download`
    - Download latest translations from Crowdin
  - `npm run i18n:csv-to-json`
    - Transform all consolidated CSVs into per-locale JSON files
  - `npm run i18n:sync`
    - `consolidate → upload → download → csv-to-json`

- Dev/build hooks
  - `predev` / `prebuild`:
    - If `CROWDIN_API_TOKEN` is set: run `i18n:crowdin:download`
    - Always run `i18n:csv-to-json` to ensure the app has up-to-date per-locale JSON

Environment variables:
- `CROWDIN_API_TOKEN`: required for upload/download operations

Notes:
- Crowdin steps are optional during dev; without `CROWDIN_API_TOKEN` the app still builds using local CSVs.

---

## Adding new languages/locales

1. Ensure columns exist in the consolidated CSVs for the new locale (e.g., `it`, `pt-BR`).
2. Upload to Crowdin:
   - `npm run i18n:crowdin:upload`
3. Translators add new translations in Crowdin.
4. Pull updates and generate JSON:
   - `npm run i18n:crowdin:download`
   - `npm run i18n:csv-to-json`

The CSV → JSON tool will:
- Detect new languages from CSV headers automatically
- Create directories like `src/translations/<lang>/<region?>/`
- Write `src/translations/<lang>/<region?>/<locale>-componentTranslations.json`

At runtime, `src/translations/i18n.ts` will auto-import new `**-componentTranslations.json` files and register them in `languageOptions` without further code changes.

---

## Runtime i18n integration

- The app initializes i18n in `src/translations/i18n.ts`.
- Base messages are loaded for existing locales and then deep-merged with any detected `**-componentTranslations.json` files.
- New locales are added to `languageOptions` dynamically, with a best-effort display name.

If you need to restrict what appears in the language selector, filter the `languageOptions` exported object accordingly.

---

## Cypress validation of locales

Two specs are provided:

- `cypress/e2e/testTasks.cy.ts`
  - Logs in and asserts participant tasks load (requires a participant account)
- `cypress/e2e/locales.cy.ts`
  - Iterates through locales: `en, en-US, es, es-CO, de, fr-CA, nl, en-GH, de-CH, es-AR`
  - Sets the locale in session storage before visiting `/signin`
  - Logs in and verifies navigation away from `/signin`

Environment options (set via shell or `cypress.env.json`):
- `E2E_USE_ENV=TRUE` to enable env-based overrides for tests
- `E2E_BASE_URL="https://localhost:5173/signin"`
- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- `E2E_LOCALES="en,es,de"` (optional, to subset the locales)

Example `cypress.env.json`:
```json
{
  "E2E_USE_ENV": "TRUE",
  "E2E_BASE_URL": "https://localhost:5173/signin",
  "E2E_TEST_EMAIL": "oscar@cardinalfamily.com",
  "E2E_TEST_PASSWORD": "admin123"
}
```

Run Cypress headless with seeded users:
```bash
# Optional: provide admin credentials to seed via firebase-admin
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json

# Start dev (HTTPS via mkcert)
npm run dev

# Run tests using env
E2E_USE_ENV=TRUE \
E2E_BASE_URL="https://localhost:5173/signin" \
E2E_TEST_EMAIL="oscar@cardinalfamily.com" \
E2E_TEST_PASSWORD="admin123" \
npm run cypress:run-seeded
```

---

## Seeding DEV users for tests

Scripts (in `scripts/`):
- `seed-dev-user-admin.js` (preferred): uses `firebase-admin` to upsert `users/<uid>`
  - Requires `FIREBASE_ADMIN_CREDENTIALS` (inline JSON) or `GOOGLE_APPLICATION_CREDENTIALS` (file path)
- `seed-dev-user.js`: client sign-in to obtain an ID token, then Firestore REST write
- `seed-dev-participant.js`: sign-up-or-sign-in a participant and upsert the Firestore user

Convenience script:
- `npm run cypress:run-seeded`
  - Attempts admin seed, then client seed, then participant seed, then runs Cypress

Defaults used by seeding scripts (override via env):
- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- `E2E_FIREBASE_PROJECT_ID` (default: `hs-levante-admin-dev`)
- `E2E_FIREBASE_API_KEY` (default: DEV admin apiKey)

---

## Troubleshooting

- Dev server port
  - Vite serves HTTPS and prefers port 5173, but will auto-switch if occupied
  - Adjust `E2E_BASE_URL` accordingly (e.g., `https://localhost:5174/signin`)

- Crowdin authentication
  - Ensure `CROWDIN_API_TOKEN` is set for upload/download
  - Without it, dev still transforms local CSVs via `i18n:csv-to-json`

- CSV gotchas
  - Newlines are escaped as `\n` during consolidation to avoid row splitting; the JSON builder restores them on write

- Cypress input typing detachment
  - Tests use `{selectall}{backspace}` + `type()` and re-query inputs to avoid stale element issues during re-renders

---

## Summary
- Authoritative strings live in multilingual CSVs
- Crowdin manages translations per column
- Build step writes per-locale JSON files that the app consumes
- New locales are auto-detected and auto-registered
- A Cypress suite validates that each locale can load and navigate post-signin
