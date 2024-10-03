import axios from 'axios';
import _merge from 'lodash/merge';
import { BufferLoader, AudioContext } from '@/helpers/audio';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';
const context = new AudioContext();


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

  export function restoreSurveyData({ surveyInstance, uid, selectedAdmin, surveyResponsesData, gameStore }) {
    // Try to get data from localStorage first
    const prevData = window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);
    if (prevData) {
      const parsedData = JSON.parse(prevData);
      surveyInstance.data = parsedData.responses;
      surveyInstance.currentPageNo = parsedData.pageNo;
      return { isRestored: true, pageNo: parsedData.pageNo };
    } else if (surveyResponsesData) {
      // If not in localStorage, try to find data from the server
      const surveyResponse = surveyResponsesData.find((doc) => doc?.administrationId === selectedAdmin);
      if (surveyResponse) {
        if (!gameStore.isGeneralSurveyComplete) {
          surveyInstance.data = surveyResponse.general.responses;
        } else {
          const specificIndex = gameStore.specificSurveyRelationIndex;
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
    numGeneralPages, 
    numSpecificPages,
    specificIds,
    userType,
    gameStore
  }) {  
    const currentPageNo = survey.currentPageNo;

    if (window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`)) {
      const prevData = JSON.parse(window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`));

      // Update the page number at the top level
      prevData.pageNo = currentPageNo;
      prevData.responses[questionName] = responseValue;

      window.localStorage.setItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`, JSON.stringify(prevData));

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


      console.log('selectedAdmin: ', selectedAdmin);


      if (!gameStore.isGeneralSurveyComplete) {
        newData.responses[questionName] = responseValue;
      } else {
        const specificIndex = gameStore.specificSurveyRelationIndex;
        console.log('specificIndex in saveSurveyData: ', specificIndex);
        newData.specificId = specificIds[specificIndex];
        newData.responses[questionName] = responseValue;
        newData.isComplete = false;
        newData.isGeneral = false;
      }

      console.log('newData after adding responses: ', newData);

        window.localStorage.setItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`, JSON.stringify(newData));

      try {
        roarfirekit.saveSurveyResponses({
          surveyData: newData,
          administrationId: selectedAdmin ?? null,
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
    gameStore, 
    router, 
    toast, 
    queryClient, 
    specificIds, 
    userType 
  }) {
    const allQuestions = sender.getAllQuestions();
    const unansweredQuestions = {};

    allQuestions.forEach((question) => (unansweredQuestions[question.name] = null));

    // NOTE: Values from the second object overwrite values from the first
    const responsesWithAllQuestions = _merge(unansweredQuestions, sender.data);


    console.log('isGeneralSurveyComplete in final: ', gameStore.isGeneralSurveyComplete);

    // Structure the data
    const structuredResponses = {
      pageNo: 0,
      isGeneral: true,
      isComplete: true,
      specificId: 0,
      responses: responsesWithAllQuestions,
      userType: userType,
    };

    console.log('structuredResponses: ', structuredResponses);

    // Update specificId if it's a specific survey
    if (gameStore.isGeneralSurveyComplete) {
      structuredResponses.isGeneral = false;
      const specificIndex = gameStore.specificSurveyRelationIndex;
      structuredResponses.specificId = specificIds[specificIndex];
    }

    // turn on loading state
    gameStore.setIsSavingSurveyResponses(true);

    // call cloud function to save the survey results
    try {
      await roarfirekit.saveSurveyResponses({
        surveyData: structuredResponses,
        administrationId: gameStore?.selectedAdmin?.id ?? null,
      });

      // Clear localStorage after successful submission
      window.localStorage.removeItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);

      // update game store to let game tabs know
      if (userType === 'student') {
        gameStore.setSurveyCompleted();
      } else {
        if (!gameStore.isGeneralSurveyComplete) {
          gameStore.setIsGeneralSurveyComplete(true);
        } else if (gameStore.specificSurveyRelationIndex === gameStore.specificSurveyRelationData.length - 1) {
          gameStore.setIsSpecificSurveyComplete(true);
        }
      }

      gameStore.setSpecificSurveyRelationIndex(gameStore.specificSurveyRelationIndex + 1);

      queryClient.invalidateQueries({ queryKey: ['surveyResponses', uid] });

      gameStore.requireHomeRefresh();
      // router.push({ name: 'Home' });
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
