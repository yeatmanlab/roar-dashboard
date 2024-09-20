import { getParsedLocale, fetchBuffer, showAndPlaceAudioButton, restoreSurveyData, saveSurveyData, saveFinalSurveyData } from '@/helpers/survey';

export async function initializeSurvey({
  surveyInstance,
  userType,
  specificSurveyData,
  userData,
  gameStore,
  locale,
  audioLinkMap,
}) {
  const numGeneralQuestions = surveyInstance.getAllQuestions().length;

  if (userType === 'parent' || userType === 'teacher') {
    addSpecificPages(surveyInstance, specificSurveyData, userType, userData, gameStore, numGeneralQuestions);
  }

  if (userType === 'student') {
    await setupStudentAudio(surveyInstance, locale, audioLinkMap, gameStore);
  }

  await restoreSurveyData({
    surveyInstance,
    uid: userData.id,
    selectedAdmin: userData.selectedAdminId,
    surveyResponsesData: userData.surveyResponsesData,
  });

  if (userType === 'student') {
    gameStore.setSurveyQuestions(numGeneralQuestions, 0);
    gameStore.setSurveyPages(surveyInstance.pages.length, 0);
  }
}

function addSpecificPages(surveyInstance, specificSurveyData, userType, userData, gameStore, numGeneralQuestions) {
  const numberOfSpecificPages = specificSurveyData.pages.length;
  gameStore.setSurveyPages(surveyInstance.pages.length, numberOfSpecificPages);

  const count = userType === 'parent' ? userData.childIds.length : userData.classes.current.length;
  const prefix = userType === 'parent' ? 'child' : 'class';

  for (let i = 0; i < count; i++) {
    specificSurveyData.pages.forEach((page, pageIndex) => {
      const newPageName = `${page.name}_${prefix}${i + 1}`;
      const newPage = surveyInstance.createNewPage(newPageName);
      
      const clonedPage = JSON.parse(JSON.stringify(page));
      clonedPage.elements.forEach(element => {
        element.name = `${element.name}_${prefix}${i + 1}`;
      });
      
      newPage.fromJSON(clonedPage);
      surveyInstance.addPage(newPage);

      if (i === count - 1 && pageIndex === numberOfSpecificPages - 1) {
        const totalQuestions = surveyInstance.getAllQuestions().length;
        const numberOfSpecificQuestions = totalQuestions - numGeneralQuestions;
        gameStore.setSurveyQuestions(numGeneralQuestions, numberOfSpecificQuestions);
      }
    });
  }
}

async function setupStudentAudio(surveyInstance, locale, audioLinkMap, gameStore) {
  const parsedLocale = getParsedLocale(locale);
  await fetchBuffer({ 
    parsedLocale, 
    setSurveyAudioLoading: gameStore.setSurveyAudioLoading, 
    audioLinks: audioLinkMap, 
    surveyAudioBuffers: gameStore.surveyAudioPlayerBuffers, 
    setSurveyAudioPlayerBuffers: gameStore.setSurveyAudioPlayerBuffers 
  });

  surveyInstance.onAfterRenderPage.add((__, { htmlElement }) => {
    const questionElements = htmlElement.querySelectorAll('div[id^=sq_]');
    if (gameStore.currentSurveyAudioSource) {
      gameStore.currentSurveyAudioSource.stop();
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
  gameStore,
  router,
  toast,
  queryClient,
  userData,
}) {
  surveyInstance.onValueChanged.add((sender, options) => 
    saveSurveyData({ 
      survey: sender, 
      roarfirekit, 
      uid, 
      selectedAdmin: selectedAdminId, 
      questionName: options.name, 
      responseValue: options.value,
      userType,
      numGeneralPages: gameStore.numGeneralPages,
      numSpecificPages: gameStore.numSpecificPages,
      gameStore,
      specificIds: userType === 'parent' ? userData.childIds : userData.classes.current,
      saveSurveyResponses: roarfirekit.saveSurveyResponses
    })
  );

  surveyInstance.onCurrentPageChanged.add(() => 
    saveSurveyData({ 
      survey: surveyInstance, 
      roarfirekit, 
      uid, 
      selectedAdmin: selectedAdminId 
    })
  );

  surveyInstance.onComplete.add((sender) => 
    saveFinalSurveyData({ 
      sender, 
      roarfirekit, 
      uid, 
      gameStore, 
      router, 
      toast, 
      queryClient 
    })
  );
}
