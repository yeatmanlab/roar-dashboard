import {
  getParsedLocale,
  fetchBuffer,
  showAndPlaceAudioButton,
  restoreSurveyData,
  saveFinalSurveyData,
  saveSurveyData,
  type AudioLinkMap,
  type RoarfirekitType,
  type LocalStorageSurveyData,
} from '@/helpers/survey';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';
import type { SurveyModel, PageModel, Question, CompleteEvent } from 'survey-core';
import type { Router } from 'vue-router';
import type { ToastServiceMethods } from 'primevue/toastservice';
import type { QueryClient } from '@tanstack/vue-query';

interface UserData {
  id: string;
  selectedAdminId: string | null;
  surveyResponsesData: any;
  childIds?: (string | number)[];
  classes?: { current: (string | number)[] };
  currentSurveyAudioSource: { stop: () => void } | null;
  isGeneralSurveyComplete: boolean;
  specificSurveyRelationIndex: number;
}

interface SurveyStore {
  setAllSurveyPages: (pages: PageModel[]) => void;
  setAllSpecificPages: (pages: PageModel[]) => void;
  setNumberOfSurveyPages: (general: number, specific: number) => void;
  setSurveyAudioLoading: (loading: boolean) => void;
  setSurveyAudioPlayerBuffers: (locale: string, buffers: AudioBuffer[]) => void;
  surveyAudioPlayerBuffers: Record<string, AudioBuffer[]>;
  currentSurveyAudioSource: { stop: () => void } | null;
  isGeneralSurveyComplete: boolean;
  specificSurveyRelationIndex: number;
}

interface SurveyData {
  pages: PageModel[];
}

interface InitializeSurveyParams {
  surveyInstance: SurveyModel;
  userType: string;
  specificSurveyData?: SurveyData;
  userData: UserData;
  surveyStore: SurveyStore;
  locale: string | undefined | null;
  audioLinkMap: AudioLinkMap;
  generalSurveyData: SurveyData;
}

interface GameStore {
  // Define necessary methods/properties used, e.g.:
  // requireHomeRefresh: () => void;
}

interface SetupSurveyEventHandlersParams {
  surveyInstance: SurveyModel;
  userType: string;
  roarfirekit: RoarfirekitType;
  uid: string;
  selectedAdminId: string | null;
  surveyStore: SurveyStore;
  router: Router;
  toast: ToastServiceMethods;
  queryClient: QueryClient;
  userData: UserData;
  gameStore: GameStore;
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
    surveyStore: surveyStore as any,
  });

  const allGeneralPages = generalSurveyData.pages;
  const allSpecificPages = specificSurveyData?.pages || [];
  surveyStore.setAllSurveyPages(allGeneralPages);
  surveyStore.setAllSpecificPages(allSpecificPages);

  const numGeneralPages = allGeneralPages.length;
  const numSpecificPages = allSpecificPages.length;
  surveyStore.setNumberOfSurveyPages(numGeneralPages, numSpecificPages);

  if (userType === 'student') {
    await setupStudentAudio(surveyInstance, locale, audioLinkMap, surveyStore as any);
  }
}

export async function setupStudentAudio(
  surveyInstance: SurveyModel,
  locale: string | undefined | null,
  audioLinkMap: AudioLinkMap,
  surveyStore: SurveyStore,
): Promise<void> {
  const parsedLocale = getParsedLocale(locale);
  await fetchBuffer({
    parsedLocale,
    setSurveyAudioLoading: surveyStore.setSurveyAudioLoading,
    audioLinks: audioLinkMap,
    surveyAudioBuffers: surveyStore.surveyAudioPlayerBuffers,
    setSurveyAudioPlayerBuffers: surveyStore.setSurveyAudioPlayerBuffers as (
      locale: string,
      buffers: AudioBuffer[],
    ) => void,
  });

  surveyInstance.onAfterRenderPage.add((sender: SurveyModel, options: { htmlElement: HTMLElement }) => {
    const questionElements = options.htmlElement.querySelectorAll('div[id^=sq_]');
    if (surveyStore.currentSurveyAudioSource) {
      surveyStore.currentSurveyAudioSource.stop();
    }
    questionElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const playAudioButton = document.getElementById('audio-button-' + htmlEl.dataset.name);
      showAndPlaceAudioButton({
        playAudioButton: playAudioButton as HTMLElement | null,
        el: htmlEl,
      });
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
  let specificIds: (string | number)[] = [];
  if (userType === 'parent') {
    specificIds = userData.childIds || [];
  } else if (userType === 'teacher') {
    specificIds = userData.classes?.current || [];
  }

  surveyInstance.onValueChanged.add((sender: SurveyModel, options: { name: string; question: Question; value: any }) =>
    saveSurveyData({
      survey: sender,
      uid,
      questionName: options.name,
      responseValue: options.value,
      userType,
      surveyStore: surveyStore as any,
      specificIds: specificIds,
    }),
  );

  surveyInstance.onCurrentPageChanged.add(
    (
      sender: SurveyModel,
      options: {
        oldCurrentPage: PageModel | null;
        newCurrentPage: PageModel;
        isNextPage: boolean;
        isPrevPage: boolean;
      },
    ) => {
      const previousPage = options.oldCurrentPage;

      if (previousPage) {
        const previousPageQuestions = previousPage.questions as Question[];
        const prevDataStr = window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);

        if (prevDataStr) {
          const parsedData: LocalStorageSurveyData = JSON.parse(prevDataStr);
          const previousPageResponses: Record<string, { responseValue: string; responseTime: string }> = {
            ...parsedData.responses,
          };

          previousPageQuestions.forEach((question) => {
            if (parsedData.responses[question.name] !== undefined) {
              previousPageResponses[question.name] = parsedData.responses[question.name];
            }
          });

          const dataToSave = {
            responses: previousPageResponses,
            pageNo: previousPage.visibleIndex,
            isComplete: false,
            isGeneral: !surveyStore.isGeneralSurveyComplete,
            specificId: surveyStore.isGeneralSurveyComplete ? specificIds[surveyStore.specificSurveyRelationIndex] : 0,
            userType: userType,
          };

          try {
            roarfirekit.saveSurveyResponses({
              surveyData: dataToSave,
              administrationId: selectedAdminId,
            });
          } catch (error: unknown) {
            console.error(
              'Error saving previous page responses: ',
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      }
    },
  );

  surveyInstance.onComplete.add((sender: SurveyModel, options: CompleteEvent) =>
    saveFinalSurveyData({
      sender,
      roarfirekit,
      uid,
      surveyStore: surveyStore as any,
      router,
      toast,
      queryClient,
      specificIds: specificIds,
      selectedAdmin: selectedAdminId,
      userType,
      gameStore: gameStore as any,
    }),
  );
}
