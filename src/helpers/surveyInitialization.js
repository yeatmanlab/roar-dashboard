import { 
  getParsedLocale, 
  fetchBuffer, 
  showAndPlaceAudioButton, 
  restoreSurveyData, 
  saveFinalSurveyData,
  saveSurveyData,
} from '@/helpers/survey';

export async function initializeSurvey({
  surveyInstance,
  userType,
  specificSurveyData,
  userData,
  gameStore,
  locale,
  audioLinkMap,
  generalSurveyData,
}) {
  const { isRestored, pageNo } = restoreSurveyData({
    surveyInstance,
    uid: userData.id,
    selectedAdmin: userData.selectedAdminId,
    surveyResponsesData: userData.surveyResponsesData,
    gameStore,
  });

  // Store all pages from the survey JSON
  const allGeneralPages = generalSurveyData.pages;
  const allSpecificPages = specificSurveyData?.pages || [];
  gameStore.setAllSurveyPages(allGeneralPages);
  gameStore.setAllSpecificPages(allSpecificPages);

  console.log('num general pages: ', allGeneralPages.length);
  console.log('num specific pages: ', allSpecificPages.length);

  const numGeneralPages = allGeneralPages.length;
  const numSpecificPages = allSpecificPages.length;
  gameStore.setNumberOfSurveyPages(numGeneralPages, numSpecificPages);

  console.log('pages: ', surveyInstance.pages);


  if (userType === 'student') {
    await setupStudentAudio(surveyInstance, locale, audioLinkMap, gameStore);
  }

  gameStore.setNumberOfSurveyPages(numGeneralPages, numSpecificPages);
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
      numGeneralPages: gameStore.numGeneralPages,
      numSpecificPages: gameStore.numSpecificPages,
      gameStore,
      specificIds: specificIds,
      saveSurveyResponses: roarfirekit.saveSurveyResponses
    })
  );

  surveyInstance.onCurrentPageChanging.add(async (sender, options) => {
    const numGeneralPages = gameStore.numGeneralPages;
    const numSpecificPages = gameStore.numSpecificPages;
    let specificCount = 0;
    if (userType === 'parent') {
      specificCount = userData.childIds.length;
    } else if (userType === 'teacher') {
      specificCount = userData.classes.current.length;
    }
    const totalPages = numGeneralPages + (numSpecificPages * specificCount);

    // console.log('page index before: ', gameStore.currentPageIndex);

    if (options.isGoingForward) {
      gameStore.setCurrentPageIndex(gameStore.currentPageIndex + 1);
    } else if (options.isGoingBackward) {
      gameStore.setCurrentPageIndex(gameStore.currentPageIndex - 1);
    }

    const currentPageIndex = gameStore.currentPageIndex;
    // console.log('page index after: ', currentPageIndex);


    // if (options.isGoingForward && (currentPageIndex + 3 < totalPages) && currentPageIndex >= 2) {
    //   // Add next page
    //   const nextPageIndex = currentPageIndex + 3;
    //   addPageToSurvey(sender, nextPageIndex, userType, userData, gameStore);

    //   // Remove first page
    //   surveyInstance.removePage(surveyInstance.pages[0]);

    // } else if (options.isGoingBackward && currentPageIndex - 3 >= 0 && (currentPageIndex <= totalPages - 3)) {
    //   // Add previous page
    //   const prevPageIndex = currentPageIndex - 3;
    //   addPageToSurvey(sender, prevPageIndex, userType, userData, gameStore, true);

    //   // Remove last page
    //   surveyInstance.removePage(surveyInstance.pages[surveyInstance.pages.length - 1]);
    // }

    // if (options.isGoingForward) {
    //   gameStore.setCurrentPageIndex(currentPageIndex + 1);
    // } else if (options.isGoingBackward) {
    //   gameStore.setCurrentPageIndex(currentPageIndex - 1);
    // }
  });


  surveyInstance.onComplete.add((sender) => 
    saveFinalSurveyData({ 
      sender, 
      roarfirekit, 
      uid, 
      gameStore, 
      router, 
      toast, 
      queryClient,
      specificIds: specificIds,
      userType,
    })
  );

}
