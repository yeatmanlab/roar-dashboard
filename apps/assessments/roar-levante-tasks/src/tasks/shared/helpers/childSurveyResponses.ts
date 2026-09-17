import { taskStore } from '../../../taskStore';

export function getChildSurveyResponses() {
  const t = taskStore().translations;
  const responses = t.childSurveyRespoonses || t.childSurveyResponses;

  return responses.split(';');
}
