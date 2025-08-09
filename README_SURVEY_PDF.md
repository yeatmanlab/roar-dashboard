Survey to PDF (developer notes)

This repo includes a simple helper to export SurveyJS JSON to a PDF without changing any UI.

- Helper: src/helpers/surveyPdfGenerator.ts
- API:
  - generateSurveyPdfFromJson(surveyJson, { filename?, margin?, title? })
  - appendElementAsImage(doc, element, margin?)

Example usage (in a dev-only page or script):

import { generateSurveyPdfFromJson } from '@/helpers/surveyPdfGenerator'

async function run() {
const survey = { title: 'Demo', pages: [{ title: 'Page 1', elements: [{ name: 'q1', title: 'Question 1' }] }] }
await generateSurveyPdfFromJson(survey, { filename: 'survey.pdf' })
}

Notes

- This is a text-only export for quick sharing/testing; extend as needed.
- No UI changes are required; you can invoke from a console or a dev-only route.
