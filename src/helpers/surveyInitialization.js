import { 
  getParsedLocale, 
  fetchBuffer, 
  showAndPlaceAudioButton, 
  restoreSurveyData, 
  saveSurveyData, 
  saveFinalSurveyData 
} from '@/helpers/survey';

export async function initializeSurvey({
  surveyInstance,
  userType,
  specificSurveyData,
  userData,
  gameStore,
  locale,
  audioLinkMap,
  generalSurveyData, // Add this parameter
}) {
  const isRestored = restoreSurveyData({
    surveyInstance,
    uid: userData.id,
    selectedAdmin: userData.selectedAdminId,
    surveyResponsesData: userData.surveyResponsesData,
  });

  if (isRestored) return;

  // Store all pages from the survey JSON
  const allPages = generalSurveyData.pages;
  gameStore.setAllSurveyPages(allPages);

  // Add initial 3 pages manually
  for (let i = 0; i < Math.min(3, allPages.length); i++) {
    const newPage = surveyInstance.addNewPage(allPages[i].name);
    newPage.fromJSON(allPages[i]);
  }

  gameStore.setCurrentPageIndex(0);

  if (userType === 'parent' || userType === 'teacher') {
    addSpecificPages(surveyInstance, specificSurveyData, userType, userData, gameStore);
  }

  if (userType === 'student') {
    await setupStudentAudio(surveyInstance, locale, audioLinkMap, gameStore);
  }

  if (userType === 'student') {
    gameStore.setSurveyPages(surveyInstance.pages.length, 0);
  }
}

function addSpecificPages(surveyInstance, specificSurveyData, userType, userData, gameStore) {
  const numberOfSpecificPages = specificSurveyData.pages.length;
  gameStore.setSurveyPages(surveyInstance.pages.length, numberOfSpecificPages);

  const count = userType === 'parent' ? userData.childIds.length : userData.classes.current.length;
  const prefix = userType === 'parent' ? 'child' : 'class';

  for (let i = 0; i < count; i++) {
    specificSurveyData.pages.forEach((page) => {
      const newPageName = `${page.name}_${prefix}${i + 1}`;
      const newPage = surveyInstance.createNewPage(newPageName);
      
      const clonedPage = JSON.parse(JSON.stringify(page));
      clonedPage.elements.forEach(element => {
        element.name = `${element.name}_${prefix}${i + 1}`;
      });
      
      newPage.fromJSON(clonedPage);
      surveyInstance.addPage(newPage);
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
  // surveyInstance.onValueChanged.add((sender, options) => 
  //   saveSurveyData({ 
  //     survey: sender, 
  //     roarfirekit, 
  //     uid, 
  //     selectedAdmin: selectedAdminId, 
  //     questionName: options.name, 
  //     responseValue: options.value,
  //     userType,
  //     numGeneralPages: gameStore.numGeneralPages,
  //     numSpecificPages: gameStore.numSpecificPages,
  //     gameStore,
  //     specificIds: userType === 'parent' ? userData.childIds : userData.classes.current,
  //     saveSurveyResponses: roarfirekit.saveSurveyResponses
  //   })
  // );

  // surveyInstance.onCurrentPageChanged.add((sender) => 
  //   saveSurveyData({ 
  //     survey: sender, 
  //     roarfirekit, 
  //     uid, 
  //     selectedAdmin: selectedAdminId,
  //     questionName: options.name, 
  //     responseValue: options.value,
  //     userType,
  //     numGeneralPages: gameStore.numGeneralPages,
  //     numSpecificPages: gameStore.numSpecificPages,
  //     gameStore,
  //     specificIds: userType === 'parent' ? userData.childIds : userData.classes.current,
  //     saveSurveyResponses: roarfirekit.saveSurveyResponses 
  //   })
  // );

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

  let previousPage = null;

  surveyInstance.onCurrentPageChanged.add((sender, options) => {
    const currentPageIndex = gameStore.currentPageIndex;
    const allPages = gameStore.allSurveyPages;

    if (options.newCurrentPage === surveyInstance.pages[2] && currentPageIndex + 3 < allPages.length) {
      // Add next page
      const newPage = surveyInstance.addNewPage(allPages[currentPageIndex + 3].name);
      newPage.fromJSON(allPages[currentPageIndex + 3]);
      surveyInstance.addPage(newPage);

      // Remove first page
      if (previousPage) {
        surveyInstance.removePage(previousPage);
      }

      gameStore.setCurrentPageIndex(currentPageIndex + 1);
    } else if (options.oldCurrentPage === surveyInstance.pages[0] && currentPageIndex > 0) {
      // Add previous page
      const newPage = surveyInstance.addNewPage(allPages[currentPageIndex - 1].name);
      newPage.fromJSON(allPages[currentPageIndex - 1]);
      surveyInstance.pages.unshift(newPage);

      // Remove last page
      surveyInstance.removePage(surveyInstance.pages[surveyInstance.pages.length - 1]);

      gameStore.setCurrentPageIndex(currentPageIndex - 1);
    }

    previousPage = options.oldCurrentPage;
  });
}
