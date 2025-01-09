import axios from 'axios';
import _merge from 'lodash/merge';
import { BufferLoader, AudioContext } from '@/helpers/audio';
import { TOAST_SEVERITIES } from '../constants/toasts';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';
import { SURVEY_RESPONSES_QUERY_KEY } from '@/constants/queryKeys';
import {
  GOOGLE_STORAGE_API_BASE_URL,
  ROAD_DASHBOARD_BUCKET,
  GOOGLE_STORAGE_API_BUCKET_LIST_ENDPOINT,
} from '@/constants/bucket';

export const fetchAudioLinks = async (surveyType) => {
  const bucketUrl = `${GOOGLE_STORAGE_API_BASE_URL}/${ROAD_DASHBOARD_BUCKET}${GOOGLE_STORAGE_API_BUCKET_LIST_ENDPOINT}`;
  const response = await axios.get(bucketUrl);
  const files = response.data || { items: [] };
  const audioLinkMap = {};
  files.items.forEach((item) => {
    if (item.contentType === 'audio/mpeg' && item.name.startsWith(surveyType)) {
      const splitParts = item.name.split('/');
      const fileLocale = splitParts[1];
      const fileName = splitParts.at(-1).split('.')[0];
      if (!audioLinkMap[fileLocale]) {
        audioLinkMap[fileLocale] = {};
      }
      audioLinkMap[fileLocale][fileName] = `https://storage.googleapis.com/road-dashboard/${item.name}`;
    }
  });
  return audioLinkMap;
};

export function getParsedLocale(locale) {
  return (locale || '').split('-')?.[0] || 'en';
}

function finishedLoading({ bufferList, parsedLocale, setSurveyAudioLoading, setSurveyAudioPlayerBuffers }) {
  setSurveyAudioPlayerBuffers(parsedLocale, bufferList);
  setSurveyAudioLoading(false);
}

// Function to fetch buffer or return from the cache
export const fetchBuffer = ({
  parsedLocale,
  setSurveyAudioLoading,
  audioLinks,
  surveyAudioBuffers,
  setSurveyAudioPlayerBuffers,
}) => {
  const context = new AudioContext();
  // buffer already exists for the given local
  if (surveyAudioBuffers[parsedLocale]) {
    return;
  }
  setSurveyAudioLoading(true);
  const bufferLoader = new BufferLoader(context, audioLinks[parsedLocale], (bufferList) =>
    finishedLoading({ bufferList, parsedLocale, setSurveyAudioLoading, setSurveyAudioPlayerBuffers }),
  );

  bufferLoader.load();
};

export const showAndPlaceAudioButton = ({ playAudioButton, el }) => {
  if (playAudioButton) {
    playAudioButton.classList.add('play-button-visible');
    playAudioButton.style.display = 'flex';
    el.appendChild(playAudioButton);
  }
};

// Retrieve survey responses data from localStorage
const getSurveyResponsesData = (userId) => {
  const surveyResponsesData = window.localStorage.getItem(`${SURVEY_RESPONSES_QUERY_KEY}-${userId}`);
  return surveyResponsesData ? JSON.parse(surveyResponsesData) : null;
};

// Set survey responses data to localStorage
const setSurveyResponseData = (userId, data) => {
  window.localStorage.setItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${userId}`, JSON.stringify(data));
};

export function restoreSurveyData({ surveyInstance, uid, selectedAdmin, surveyResponsesData, surveyStore }) {
  // Try to get data from localStorage first
  const prevData = getSurveyResponsesData(uid);
  if (prevData) {
    surveyInstance.data = prevData.responses;
    surveyInstance.currentPageNo = prevData.pageNo;
    return { isRestored: true, pageNo: prevData.pageNo };
  } else if (surveyResponsesData) {
    // If not in localStorage, try to find data from the server
    const surveyResponse = surveyResponsesData.find((doc) => doc?.administrationId === selectedAdmin);
    if (surveyResponse) {
      if (!surveyStore.isGeneralSurveyComplete) {
        surveyInstance.data = surveyResponse.general.responses;
      } else {
        const specificIndex = surveyStore.specificSurveyRelationIndex;
        surveyInstance.data = surveyResponse.specific[specificIndex].responses;
      }

      surveyInstance.currentPageNo = surveyResponse.pageNo;
      return { isRestored: true, pageNo: surveyResponse.pageNo };
    }
  }

  // If there's no data in localStorage and no data from the server,
  // the survey has never been started, so we continue with an empty survey
  return { isRestored: false, pageNo: 0 };
}

export function saveSurveyData({
  survey,
  roarfirekit,
  uid,
  selectedAdmin,
  questionName,
  responseValue,
  specificIds,
  userType,
  surveyStore,
}) {
  const currentPageNo = survey.currentPageNo;

  const prevData = getSurveyResponsesData(uid);
  if (prevData) {
    // Update the page number at the top level
    prevData.pageNo = currentPageNo;
    prevData.responses[questionName] = responseValue;

    // Save the update data to localStorage
    setSurveyResponseData(uid, prevData);

    try {
      roarfirekit.saveSurveyResponses({
        surveyData: prevData,
        administrationId: selectedAdmin ?? null,
      });
    } catch (error) {
      console.error('Error saving survey responses: ', error);
    }
  } else {
    // Initialize the structure if it doesn't exist
    const newData = {
      pageNo: currentPageNo,
      isGeneral: true,
      isComplete: false,
      specificId: 0,
      responses: {},
      userType: userType,
    };

    if (!surveyStore.isGeneralSurveyComplete) {
      newData.responses[questionName] = responseValue;
    } else {
      const specificIndex = surveyStore.specificSurveyRelationIndex;
      newData.specificId = specificIds[specificIndex];
      newData.responses[questionName] = responseValue;
      newData.isComplete = false;
      newData.isGeneral = false;
    }

    setSurveyResponseData(uid, newData);

    try {
      roarfirekit.saveSurveyResponses({
        surveyData: newData,
        administrationId: selectedAdmin,
      });
    } catch (error) {
      console.error('Error saving survey responses: ', error);
    }
  }
}

export async function saveFinalSurveyData({
  sender,
  roarfirekit,
  uid,
  surveyStore,
  selectedAdmin,
  router,
  toast,
  queryClient,
  specificIds,
  userType,
  gameStore,
}) {
  const allQuestions = sender.getAllQuestions();
  const unansweredQuestions = {};

  allQuestions.forEach((question) => (unansweredQuestions[question.name] = null));

  // NOTE: Values from the second object overwrite values from the first
  const responsesWithAllQuestions = _merge(unansweredQuestions, sender.data);

  // Structure the data
  const structuredResponses = {
    pageNo: 0,
    isGeneral: true,
    isComplete: true,
    specificId: 0,
    responses: responsesWithAllQuestions,
    userType: userType,
  };

  // Update specificId if it's a specific survey
  if (surveyStore.isGeneralSurveyComplete) {
    structuredResponses.isGeneral = false;
    const specificIndex = surveyStore.specificSurveyRelationIndex;
    structuredResponses.specificId = specificIds[specificIndex];
  }

  // turn on loading state
  surveyStore.setIsSavingSurveyResponses(true);

  // call cloud function to save the survey results
  try {
    await roarfirekit.saveSurveyResponses({
      surveyData: structuredResponses,
      administrationId: selectedAdmin ?? null,
    });

    // Clear localStorage after successful submission
    window.localStorage.removeItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);

    // update survey store to let survey tabs know
    if (userType === 'student') {
      surveyStore.setIsGeneralSurveyComplete(true);
    } else {
      if (!surveyStore.isGeneralSurveyComplete) {
        surveyStore.setIsGeneralSurveyComplete(true);
      } else if (surveyStore.specificSurveyRelationIndex === surveyStore.specificSurveyRelationData.length - 1) {
        surveyStore.setIsSpecificSurveyComplete(true);
      }
    }

    surveyStore.setSpecificSurveyRelationIndex(surveyStore.specificSurveyRelationIndex + 1);

    queryClient.invalidateQueries({ queryKey: [SURVEY_RESPONSES_QUERY_KEY] });

    gameStore.requireHomeRefresh();
    router.push({ name: 'Home' });
  } catch (error) {
    surveyStore.setIsSavingSurveyResponses(false);
    console.error(error);
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Error saving survey responses: ' + error.message,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }
}
