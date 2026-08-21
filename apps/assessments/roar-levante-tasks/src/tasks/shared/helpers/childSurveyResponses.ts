import { taskStore } from '../../../taskStore';

export function getChildSurveyResponses() {
  const t = taskStore().translations;
  const responses = [t.childSurveyResponse1, t.childSurveyResponse2, t.childSurveyResponse3, t.childSurveyResponse4];

  return responses;
}
