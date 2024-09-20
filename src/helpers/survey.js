import axios from 'axios';
import _merge from 'lodash/merge';
import { BufferLoader, AudioContext } from '@/helpers/audio';

const context = new AudioContext();
const STORAGE_ITEM_KEY = 'levante-survey';

export const fetchAudioLinks = async (surveyType) => {
    const response = await axios.get('https://storage.googleapis.com/storage/v1/b/road-dashboard/o/');
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
  export const fetchBuffer = ({ parsedLocale, setSurveyAudioLoading, audioLinks, surveyAudioBuffers, setSurveyAudioPlayerBuffers }) => {
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
  
  export async function saveSurveyData({ 
    survey, 
    roarfirekit, 
    uid, 
    selectedAdmin, 
    questionName, 
    responseValue, 
    numGeneralPages, 
    numSpecificPages,
    specificIds,
    userType,
    saveSurveyResponses 
  }) {
    const currentPageNo = survey.currentPageNo;
  
    if (window.localStorage.getItem(`${STORAGE_ITEM_KEY}-${uid}`)) {
      const prevData = JSON.parse(window.localStorage.getItem(`${STORAGE_ITEM_KEY}-${uid}`));

      // Update the page number at the top level
      prevData.pageNo = currentPageNo;

      if (currentPageNo < numGeneralPages) {
        // General survey
        if (!prevData.general) prevData.general = { responses: {} };
        prevData.general.responses[questionName] = responseValue;
      } else {
        // Specific survey
        const relationKey = userType === 'parent' ? 'childId' : 'classId';
        if (!prevData.specific) prevData.specific = [];
        
        const specificIndex = Math.floor((currentPageNo - numGeneralPages) / numSpecificPages);

        if (!prevData.specific[specificIndex]) {
          prevData.specific[specificIndex] = {
            [relationKey]: specificIds[specificIndex],
            responses: {}
          };
        }
        
        prevData.specific[specificIndex].responses[questionName] = responseValue;
      }

      window.localStorage.setItem(`${STORAGE_ITEM_KEY}-${uid}`, JSON.stringify(prevData));
      await roarfirekit.value.saveSurveyResponses({
        responses: prevData,
        administrationId: selectedAdmin ?? null,
      });
    } else {
      // Initialize the structure if it doesn't exist
      const newData = {
        pageNo: currentPageNo,
        general: {
          responses: {}
        },
        specific: []
      };

      if (currentPageNo < numGeneralPages) {
        newData.general.responses[questionName] = responseValue;
      } else {
        const relationKey = userType === 'parent' ? 'childId' : 'classId';
        const specificIndex = Math.floor((currentPageNo - numGeneralPages) / numSpecificPages);
        newData.specific[specificIndex] = {
          [relationKey]: specificIds[specificIndex],
          responses: {
            [questionName]: responseValue
          }
        };
      }

      window.localStorage.setItem(`${STORAGE_ITEM_KEY}-${uid}`, JSON.stringify(newData));
      await roarfirekit.value.saveSurveyResponses({
        responses: newData,
        administrationId: selectedAdmin ?? null,
      });
    }
  }
  
  export async function restoreSurveyData({ surveyInstance, uid, selectedAdmin, surveyResponsesData }) {
    let data = null;

    // Try to get data from localStorage first
    const prevData = window.localStorage.getItem(`${STORAGE_ITEM_KEY}-${uid}`);
    if (prevData) {
      data = JSON.parse(prevData);
    } else if (surveyResponsesData) {
      // If not in localStorage, try to find data from the server
      const surveyResponse = surveyResponsesData.find((doc) => doc?.administrationId === selectedAdmin);
      if (surveyResponse) {
        data = surveyResponse;
      }
    }

    if (data) {
      // Flatten the data structure
      const flattenedData = {};

      // Process general responses
      if (data.general && data.general.responses) {
        Object.assign(flattenedData, data.general.responses);
      }

      // Process specific responses
      if (data.specific && Array.isArray(data.specific)) {
        data.specific.forEach((specificData) => {
          if (specificData.responses) {
            Object.assign(flattenedData, specificData.responses);
          }
        });
      }

      // Restore the flattened data to the survey instance
      surveyInstance.data = flattenedData;

      // Restore the page number if available
      if (data.pageNo) {
        surveyInstance.currentPageNo = data.pageNo;
      }
    }

    // If there's no data in localStorage and no data from the server,
    // the survey has never been started, so we continue with an empty survey
  }
  
  export async function saveFinalSurveyData({ sender, roarfirekit, uid, gameStore, router, toast, queryClient }) {
    const allQuestions = sender.getAllQuestions();
    const unansweredQuestions = {};
  
    allQuestions.forEach((question) => (unansweredQuestions[question.name] = null));
  
    // Values from the second object overwrite values from the first
    const responsesWithAllQuestions = _merge(unansweredQuestions, sender.data);
    // remove pageNo, used for continuing incomplete survey, from the responses
    delete responsesWithAllQuestions.pageNo;
  
    // turn on loading state
    gameStore.setIsSavingSurveyResponses(true);
  
    // call cloud function to save the survey results
    // TODO: Use tanstack-query mutation for automaitic retries.
    try {
      await roarfirekit.value.saveSurveyResponses({
        responses: responsesWithAllQuestions,
        administrationId: gameStore?.selectedAdmin?.id ?? null,
      });
  
      // update game store to let game tabs know
      gameStore.setSurveyCompleted();
      queryClient.invalidateQueries({ queryKey: ['surveyResponses', uid] });
  
      // Clear localStorage after successful submission
      window.localStorage.removeItem(`${STORAGE_ITEM_KEY}-${uid.value}`);
  
      gameStore.requireHomeRefresh();
      router.push({ name: 'Home' });
    } catch (error) {
      gameStore.setIsSavingSurveyResponses(false);
      console.error(error);
      toast.add({
        severity: 'error',
        summary: 'Error saving survey responses: ' + error.message,
        life: 3000,
      });
    }
  }

  