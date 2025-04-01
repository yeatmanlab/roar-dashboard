import { 
  getParsedLocale, 
  fetchBuffer, 
  showAndPlaceAudioButton, 
  restoreSurveyData, 
  saveSurveyData,
} from '@/helpers/survey';

interface SurveyPage {
  [key: string]: any;
}

interface SurveyData {
  pages: SurveyPage[];
}

interface UserData {
  id: string;
  selectedAdminId: string;
  surveyResponsesData: any[];
  childIds?: string[];
  classes?: {
    current: string[];
  };
}

interface SurveyStore {
  setAllSurveyPages: (pages: SurveyPage[]) => void;
  setAllSpecificPages: (pages: SurveyPage[]) => void;
  setNumberOfSurveyPages: (general: number, specific: number) => void;
  setSurveyAudioLoading: (loading: boolean) => void;
  surveyAudioPlayerBuffers: { [key: string]: AudioBuffer[] };
  setSurveyAudioPlayerBuffers: (locale: string, buffers: AudioBuffer[]) => void;
  currentSurveyAudioSource?: AudioBufferSourceNode;
  numGeneralPages: number;
  numSpecificPages: number;
  isGeneralSurveyComplete: boolean;
  specificSurveyRelationIndex: number;
}

interface AudioLinkMap {
  [locale: string]: {
    [fileName: string]: string;
  };
}

interface InitializeSurveyParams {
  surveyInstance: any;
  userType: string;
  specificSurveyData?: SurveyData;
  userData: UserData;
  surveyStore: SurveyStore;
  locale: string;
  audioLinkMap: AudioLinkMap;
  generalSurveyData: SurveyData;
}

interface SetupStudentAudioParams {
  surveyInstance: any;
  locale: string;
  audioLinkMap: AudioLinkMap;
  surveyStore: SurveyStore;
}

interface SetupSurveyEventHandlersParams {
  surveyInstance: any;
  userType: string;
  roarfirekit: any;
  uid: string;
  selectedAdminId: string;
  surveyStore: SurveyStore;
  router: any;
  toast: any;
  queryClient: any;
  userData: UserData;
  gameStore: any;
}

export async function initializeSurvey({
  surveyInstance,
  userType,
  specificSurveyData,
  userData,
  surveyStore,
  locale,
  audioLinkMap,
  generalSurveyData,
}: InitializeSurveyParams): Promise<void> {
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

export async function setupStudentAudio(
  surveyInstance: any,
  locale: string,
  audioLinkMap: AudioLinkMap,
  surveyStore: SurveyStore
): Promise<void> {
  const parsedLocale = getParsedLocale(locale);
  await fetchBuffer({ 
    parsedLocale, 
    setSurveyAudioLoading: surveyStore.setSurveyAudioLoading, 
    audioLinks: audioLinkMap, 
    surveyAudioBuffers: surveyStore.surveyAudioPlayerBuffers, 
    setSurveyAudioPlayerBuffers: surveyStore.setSurveyAudioPlayerBuffers 
  });

  surveyInstance.onAfterRenderPage.add((__: any, { htmlElement }: { htmlElement: Element }) => {
    const questionElements = htmlElement.querySelectorAll('div[id^=sq_]');
    if (surveyStore.currentSurveyAudioSource) {
      surveyStore.currentSurveyAudioSource.stop();
    }
    questionElements.forEach((el) => {
      const playAudioButton = document.getElementById('audio-button-' + el.getAttribute('data-name'));
      if (playAudioButton) {
        showAndPlaceAudioButton({playAudioButton, el: el as HTMLElement});
      }
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
}: SetupSurveyEventHandlersParams): void {
  let specificIds: string[] = [];
  if (userType === 'parent') {
    specificIds = userData.childIds || [];
  } else if (userType === 'teacher') {
    specificIds = userData.classes?.current || [];
  }

  surveyInstance.onValueChanged.add((sender: any, options: { name: string; value: any }) => 
    saveSurveyData({ 
      survey: sender, 
      roarfirekit, 
      uid, 
      selectedAdmin: selectedAdminId, 
      questionName: options.name, 
      responseValue: options.value,
      userType,
      surveyStore,
      specificIds
    })
  );

  surveyInstance.onComplete.add((sender: any) => 
    saveSurveyData({ 
      survey: sender, 
      roarfirekit, 
      uid, 
      selectedAdmin: selectedAdminId, 
      questionName: 'completed', 
      responseValue: true,
      userType,
      surveyStore,
      specificIds
    })
  );
} 