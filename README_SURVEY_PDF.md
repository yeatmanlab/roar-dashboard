Survey to PDF (developer notes)

This repo includes a simple helper to export SurveyJS JSON to a PDF without changing any UI.

- Helper: src/helpers/surveyPdfGenerator.ts
- Loader: src/helpers/surveyLoader.ts
- API:
  - generateSurveyPdfFromJson(surveyJson, { filename?, margin?, title? })
  - appendElementAsImage(doc, element, margin?)
  - loadSurveyFromFile(filePath)
  - loadSurveysFromDir(dirPath)

Example usage (in a dev-only page or script):

import { generateSurveyPdfFromJson } from '@/helpers/surveyPdfGenerator'
import { loadSurveyFromFile } from '@/helpers/surveyLoader'

async function run() {
const survey = await loadSurveyFromFile('surveys/demo.json')
await generateSurveyPdfFromJson(survey, { filename: 'survey.pdf' })
}

Notes

- This is a text-only export for quick sharing/testing; extend as needed.
- No UI changes are required; you can invoke from a console or a dev-only route.
