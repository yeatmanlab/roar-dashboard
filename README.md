# LEVANTE Dashboard

levante-dashboard serves as the participant and administrator dashboard for LEVANTE (LEarning VAriability NeTwork Exchange) platform.

This project is a fork of ROAR, with additional support for the Levante environment.

## NPM Scripts for LEVANTE are listed in [package.json](./package.json)

## Legacy Data Flow Diagram from ROAR

See the legacy [ROAR/ROAD Data Flow Diagram here](https://miro.com/app/board/uXjVNY-_qDA=/?share_link_id=967374624080).

---

## Localization and Crowdin integration

The dashboard’s translations are managed via multilingual CSVs synced with Crowdin (project `levantetranslations`). Locally, CSVs are transformed at build-time into per-locale JSON files that the app consumes.

Key docs and tools:

- [`src/translations/README_CROWDIN.md`](./src/translations/README_CROWDIN.md) — full guide to the workflow
- [`src/translations/crowdin/crowdin.yml`](./src/translations/crowdin/crowdin.yml) — Crowdin configuration
- [`src/translations/consolidated/`](./src/translations/consolidated/) — consolidated CSV sources (main + components)
- Tools under [`src/translations/tools/`](./src/translations/tools/):
  - [`csv-to-json.js`](./src/translations/tools/csv-to-json.js) — CSV → per-locale JSON (runs during dev/build)
  - [`validate-csvs.js`](./src/translations/tools/validate-csvs.js) — validates headers, duplicates, coverage
  - [`add-locale-column.js`](./src/translations/tools/add-locale-column.js) — adds a new locale column (optionally seeded)

Common commands:

- Generate per-locale JSON: `npm run i18n:csv-to-json`
- Validate CSVs: `npm run i18n:validate`
- Add a new locale column: `I18N_NEW_LOCALE=<locale> [I18N_SEED_FROM=<base>] npm run i18n:add-locale`
- Full sync (local → Crowdin → local): `npm run i18n:sync`

Crowdin download during `npm run dev` and `npm run build` only occurs when `CROWDIN_API_TOKEN` is set; CSV→JSON always runs to ensure the app has messages available.

## Survey PDF generation

A helper is available to create PDFs from SurveyJS JSON:

- [`src/helpers/surveyPdfGenerator.ts`](./src/helpers/surveyPdfGenerator.ts)

See usage notes and examples in [`README_SURVEY_PDF.md`](./README_SURVEY_PDF.md) (if present), or integrate the helper by importing it and passing the Survey JSON you wish to export. The helper avoids UI changes and can be called from admin-only flows or scripts.
