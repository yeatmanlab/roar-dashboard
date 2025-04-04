import { 
  getParsedLocale, 
  fetchBuffer, 
  showAndPlaceAudioButton, 
  restoreSurveyData, 
  saveFinalSurveyData,
  saveSurveyData,
} from '@/helpers/survey';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';

export async function initializeSurvey({
  surveyInstance,
  userType,
  specificSurveyData,
  userData,
  surveyStore,
  locale,
  audioLinkMap,
  generalSurveyData,
}) {
  restoreSurveyData({
    surveyInstance,
    uid: userData.id,
    selectedAdmin: userData.selectedAdminId,
    surveyResponsesData: userData.surveyResponsesData,
    surveyStore,
  });

  // Store all pages from the survey JSON
  const allGeneralPages = generalSurveyData.pages;
  const allSpecificPages = specificSurveyData?.pages || [];
  surveyStore.setAllSurveyPages(allGeneralPages);
  surveyStore.setAllSpecificPages(allSpecificPages);

  const numGeneralPages = allGeneralPages.length;
  const numSpecificPages = allSpecificPages.length;
  surveyStore.setNumberOfSurveyPages(numGeneralPages, numSpecificPages);


  if (userType === 'student') {
    await setupStudentAudio(surveyInstance, locale, audioLinkMap, surveyStore);
  }

  surveyStore.setNumberOfSurveyPages(numGeneralPages, numSpecificPages);
}


export async function setupStudentAudio(surveyInstance, locale, audioLinkMap, surveyStore) {
  const parsedLocale = getParsedLocale(locale);
  await fetchBuffer({ 
    parsedLocale, 
    setSurveyAudioLoading: surveyStore.setSurveyAudioLoading, 
    audioLinks: audioLinkMap, 
    surveyAudioBuffers: surveyStore.surveyAudioPlayerBuffers, 
    setSurveyAudioPlayerBuffers: surveyStore.setSurveyAudioPlayerBuffers 
  });

  surveyInstance.onAfterRenderPage.add((__, { htmlElement }) => {
    const questionElements = htmlElement.querySelectorAll('div[id^=sq_]');
    if (surveyStore.currentSurveyAudioSource) {
      surveyStore.currentSurveyAudioSource.stop();
    }
    questionElements.forEach((el) => {
      const playAudioButton = document.getElementById('audio-button-' + el.dataset.name);
      showAndPlaceAudioButton({playAudioButton, el});
    });
  });
}

export function setupSurveyEventHandlers({
  surveyInstance,
  userType,
  roarfirekit,
  uid,
  selectedAdminId,
  surveyStore,
  router,
  toast,
  queryClient,
  userData,
  gameStore,
}) {
  let specificIds = [];
  if (userType === 'parent') {
    specificIds = userData.childIds;
  } else if (userType === 'teacher') {
    specificIds = userData.classes.current;
  }

  
  surveyInstance.onValueChanged.add((sender, options) => 
    saveSurveyData({ 
      survey: sender, 
      roarfirekit, 
      uid, 
      selectedAdmin: selectedAdminId, 
      questionName: options.name, 
      responseValue: options.value,
      userType,
      surveyStore,
      specificIds: specificIds,
    })
  );

  surveyInstance.onCurrentPageChanged.add((sender, options) => {
    const previousPage = options.oldCurrentPage;

    if (previousPage) {
      const previousPageQuestions = previousPage.questions;
      const prevData = window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);

      if (prevData) {
        const parsedData = JSON.parse(prevData);
        const previousPageResponses = {...parsedData};
        
        previousPageQuestions.forEach(question => {
          if (parsedData.responses[question.name] !== undefined) {
            previousPageResponses[question.name] = parsedData.responses[question.name];
          }
        });

        try {
          roarfirekit.saveSurveyResponses({
            surveyData: previousPageResponses,
            administrationId: selectedAdminId,
          });
        } catch (error) {
          console.error('Error saving previous page responses: ', error);
        }
      }
    }
  });


  surveyInstance.onComplete.add((sender) => 
    saveFinalSurveyData({ 
      sender, 
      roarfirekit, 
      uid, 
      surveyStore, 
      router, 
      toast, 
      queryClient,
      specificIds: specificIds,
      selectedAdmin: selectedAdminId,
      userType,
      gameStore,
    })
  );

}
