import axios from 'axios';
import _merge from 'lodash/merge';
import { BufferLoader, AudioContext, type BufferList } from '@/helpers/audio';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';
import type { SurveyModel, Question } from 'survey-core';
import type { Router } from 'vue-router';
import type { QueryClient } from '@tanstack/vue-query';
import type { RoarFirekit as RoarfirekitType } from '@bdelab/roar-firekit';
import type { ToastServiceMethods } from 'primevue/toastservice';
// @ts-expect-error - Will be resolved when store file is converted to TS
import type { UseSurveyStore } from '@/store/survey';
import type { useAssignmentsStore } from '@/store/assignments';
import {
  LEVANTE_BUCKET_STORAGE_LIST_API,
  LEVANTE_BUCKET_SURVEY_AUDIO_PREFIX,
  LEVANTE_BUCKET_URL,
} from '@/constants/bucket';
import { findBestMatchingLocale } from '@/translations/i18n';
import { toRaw } from 'vue';

export interface AudioLinkMap {
  [locale: string]: {
    [fileName: string]: string;
  };
}

interface GCSFileItem {
  contentType: string;
  name: string;
}

interface GCSListObjectsResponse {
  items?: GCSFileItem[];
  nextPageToken?: string;
}

interface FinishedLoadingParams {
  bufferList: BufferList;
  parsedLocale: string;
  setSurveyAudioLoading: (loading: boolean) => void;
  setSurveyAudioPlayerBuffers: (locale: string, buffers: AudioBuffer[]) => void;
}

interface SurveyAudioBuffers {
  [locale: string]: AudioBuffer[];
}

interface FetchBufferParams {
  parsedLocale: string;
  setSurveyAudioLoading: (loading: boolean) => void;
  audioLinks: AudioLinkMap;
  surveyAudioBuffers: SurveyAudioBuffers;
  setSurveyAudioPlayerBuffers: (locale: string, buffers: AudioBuffer[]) => void;
}

interface ShowAndPlaceAudioButtonParams {
  playAudioButton: HTMLElement | null;
  el: HTMLElement;
}

interface SurveyResponseDoc {
  administrationId?: string;
  general?: { responses: Record<string, any> };
  specific?: { responses: Record<string, any> }[];
  pageNo?: number;
}

interface RestoreSurveyDataParams {
  surveyInstance: SurveyModel;
  uid: string;
  selectedAdmin: string | null;
  surveyResponsesData: SurveyResponseDoc[] | null;
  surveyStore: UseSurveyStore;
}

interface RestoreSurveyDataResult {
  isRestored: boolean;
  pageNo: number;
}

interface SaveSurveyDataParams {
  survey: SurveyModel;
  uid: string;
  questionName: string;
  responseValue: any;
  specificIds: (string | number)[];
  userType: string;
  surveyStore: UseSurveyStore;
}

export interface LocalStorageSurveyData {
  pageNo: number;
  isGeneral: boolean;
  isComplete: boolean;
  specificId: string | number;
  responses: Record<string, any>;
  userType: string;
}

type SurveyResponse = {
  responseValue: string;
  responseTime: string;
};

interface StructuredSurveyResponse {
  pageNo: number;
  isGeneral: boolean;
  isComplete: boolean;
  specificId?: string | number;
  responses: Record<string, SurveyResponse | null>;
  userType: string;
  isEntireSurveyCompleted: boolean;
}

interface SaveFinalSurveyDataParams {
  sender: SurveyModel;
  roarfirekit: RoarfirekitType;
  uid: string;
  surveyStore: UseSurveyStore;
  selectedAdmin: string | null;
  router: Router;
  toast: ToastServiceMethods;
  queryClient: QueryClient;
  specificIds: (string | number)[];
  userType: string;
  assignmentsStore: typeof useAssignmentsStore;
}

const context = new AudioContext();

async function listAllObjectsWithPrefix(prefix: string): Promise<GCSFileItem[]> {
  const all: GCSFileItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ prefix });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    const url = `${LEVANTE_BUCKET_STORAGE_LIST_API}?${params.toString()}`;
    const { data } = await axios.get<GCSListObjectsResponse>(url);
    if (data.items?.length) {
      all.push(...data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

/**
 * Lists MP3s under `audio/<locale>/` via a prefixed GCS list (not the whole bucket).
 * Paths are `audio/<locale>/<file>.mp3`.
 * @param _surveyType legacy argument; ignored. Kept so callers do not need churn.
 */
export const fetchAudioLinks = async (_surveyType?: string): Promise<AudioLinkMap> => {
  const items = await listAllObjectsWithPrefix(LEVANTE_BUCKET_SURVEY_AUDIO_PREFIX);
  const audioLinkMap: AudioLinkMap = {};
  items.forEach((item: GCSFileItem) => {
    if (item.contentType !== 'audio/mpeg') return;
    const splitParts = item.name.split('/');
    if (splitParts.length >= 3 && splitParts[0] === 'audio') {
      const fileLocale = splitParts[1];
      const fileName = splitParts.at(-1)?.split('.')?.[0];
      if (fileName && fileLocale) {
        if (!audioLinkMap[fileLocale]) {
          audioLinkMap[fileLocale] = {};
        }
        audioLinkMap[fileLocale][fileName] = LEVANTE_BUCKET_URL + `/${item.name}`;
      }
    }
  });

  return audioLinkMap;
};

export function getParsedLocale(locale: string | undefined | null): string {
  return findBestMatchingLocale(locale);
}

/**
 * Maps dashboard locale to the `audio/<folder>/` prefix used in levante-assets-*.
 * Exceptions: German → `de`; English → `en`; otherwise the folder name matches the full locale (e.g. `es-CO`).
 */
export function resolveAudioLinksForLocale(audioLinks: AudioLinkMap, parsedLocale: string): Record<string, string> {
  const mapFor = (folderKey: string): Record<string, string> => audioLinks[folderKey] ?? {};

  if (!parsedLocale) {
    return mapFor('en');
  }

  const lower = parsedLocale.toLowerCase();

  if (lower === 'de-de' || lower.startsWith('de')) {
    return mapFor('de');
  }

  if (lower === 'en-us' || lower.startsWith('en')) {
    return mapFor('en');
  }

  return mapFor(parsedLocale);
}

function finishedLoading({
  bufferList,
  parsedLocale,
  setSurveyAudioLoading,
  setSurveyAudioPlayerBuffers,
}: FinishedLoadingParams): void {
  // @ts-expect-error - Will be resolved when store file is converted to TS
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
}: FetchBufferParams): void => {
  // buffer already exists for the given local
  if (surveyAudioBuffers[parsedLocale]) {
    return;
  }

  const urlMap = resolveAudioLinksForLocale(audioLinks, parsedLocale);
  if (Object.keys(urlMap).length === 0) {
    console.warn('[survey audio] No files for locale; check bucket folders vs app locale.', {
      parsedLocale,
      bucketLocales: Object.keys(audioLinks),
    });
    setSurveyAudioLoading(false);
    return;
  }

  setSurveyAudioLoading(true);

  const bufferLoader = new BufferLoader(context, urlMap, (bufferList: BufferList) =>
    finishedLoading({
      bufferList,
      parsedLocale,
      setSurveyAudioLoading,
      setSurveyAudioPlayerBuffers,
    }),
  );

  bufferLoader.load();
};

export const showAndPlaceAudioButton = ({ playAudioButton, el }: ShowAndPlaceAudioButtonParams): void => {
  if (playAudioButton) {
    playAudioButton.classList.add('play-button-visible');
    playAudioButton.style.display = 'flex';
    el.appendChild(playAudioButton);
  }
};

export function restoreSurveyData({
  surveyInstance,
  uid,
  selectedAdmin,
  surveyResponsesData,
  surveyStore,
}: RestoreSurveyDataParams): RestoreSurveyDataResult {
  // Try to get data from localStorage first
  const prevDataStr = window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);
  if (prevDataStr) {
    const parsedData: LocalStorageSurveyData = JSON.parse(prevDataStr);
    // The responses need to be formatted to be key value pairs with the question name as the key, and reponse as the value
    // for the Survey instance to work.
    const formattedResponses = Object.fromEntries(
      Object.entries(parsedData.responses).map(([key, value]) => [key, value.responseValue]),
    );

    surveyInstance.data = formattedResponses;
    surveyInstance.currentPageNo = parsedData.pageNo;
    return { isRestored: true, pageNo: parsedData.pageNo };
  } else if (surveyResponsesData) {
    // If not in localStorage, try to find data from the server
    const surveyResponse = surveyResponsesData.find((doc) => doc?.administrationId === selectedAdmin);
    if (surveyResponse) {
      if (!surveyStore.isGeneralSurveyComplete && surveyResponse.general) {
        const formattedResponses = Object.fromEntries(
          Object.entries(surveyResponse.general.responses).map(([key, value]) => [key, value.responseValue]),
        );

        surveyInstance.data = formattedResponses;
      } else if (surveyResponse.specific) {
        const specificIndex = surveyStore.specificSurveyRelationIndex;
        const formattedResponses = Object.fromEntries(
          Object.entries(surveyResponse.specific[specificIndex].responses).map(([key, value]) => [
            key,
            value.responseValue,
          ]),
        );
        surveyInstance.data = formattedResponses;
      }

      surveyInstance.currentPageNo = surveyResponse.pageNo ?? 0;
      return { isRestored: true, pageNo: surveyResponse.pageNo ?? 0 };
    }
  }

  // If there's no data in localStorage and no data from the server,
  // the survey has never been started, so we continue with an empty survey
  return { isRestored: false, pageNo: 0 };
}

export function saveSurveyData({
  survey,
  uid,
  questionName,
  responseValue,
  specificIds,
  userType,
  surveyStore,
}: SaveSurveyDataParams): void {
  const currentPageNo = survey.currentPageNo;
  const storageKey = `${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`;
  const prevDataStr = window.localStorage.getItem(storageKey);

  if (prevDataStr) {
    const prevData: LocalStorageSurveyData = JSON.parse(prevDataStr);

    // Update the page number at the top level
    prevData.pageNo = currentPageNo;
    prevData.responses[questionName] = {
      responseValue,
      responseTime: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(prevData));
  } else {
    // Initialize the structure if it doesn't exist
    const newData: LocalStorageSurveyData = {
      pageNo: currentPageNo,
      isGeneral: true,
      isComplete: false,
      specificId: 0,
      responses: {},
      userType: userType,
    };

    if (!surveyStore.isGeneralSurveyComplete) {
      newData.responses[questionName] = {
        responseValue,
        responseTime: new Date().toISOString(),
      };
    } else {
      const specificIndex = surveyStore.specificSurveyRelationIndex;
      newData.specificId = specificIds[specificIndex];
      newData.responses[questionName] = {
        responseValue,
        responseTime: new Date().toISOString(),
      };
      newData.isComplete = false;
      newData.isGeneral = false;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(newData));
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
  assignmentsStore,
}: SaveFinalSurveyDataParams): Promise<void> {
  const fromStorage = window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);

  let questionsFromStorage: Question[] = [];
  // TODO: Make this not reliant on local storage
  if (fromStorage) {
    questionsFromStorage = JSON.parse(fromStorage).responses;
  }

  const allQuestions = sender.getAllQuestions() as Question[];

  const unansweredQuestions: Record<string, null> = {};

  allQuestions.forEach((question) => (unansweredQuestions[question.name] = null));

  // NOTE: Values from the second object overwrite values from the first
  const responsesWithAllQuestions = _merge({}, unansweredQuestions, questionsFromStorage);

  // Structure the data
  const structuredResponses: StructuredSurveyResponse = {
    pageNo: 0,
    isGeneral: true,
    isComplete: true,
    specificId: 0,
    responses: responsesWithAllQuestions,
    userType: userType,
    isEntireSurveyCompleted: false,
  };

  // Update specificId if it's a specific survey
  if (surveyStore.isGeneralSurveyComplete) {
    structuredResponses.isGeneral = false;
    const specificIndex = surveyStore.specificSurveyRelationIndex;
    structuredResponses.specificId = specificIds[specificIndex];
  }

  let isEntireSurveyCompleted;
  if (userType === 'student') {
    isEntireSurveyCompleted = true;
  } else {
    const hasSpecificSurveys = surveyStore.specificSurveyRelationData.length > 0;
    // If the teacher/caregiver has no classes or children, the entire survey is complete
    if (!hasSpecificSurveys) {
      isEntireSurveyCompleted = true;
    } else {
      isEntireSurveyCompleted =
        surveyStore.isGeneralSurveyComplete &&
        surveyStore.specificSurveyRelationIndex === surveyStore.specificSurveyRelationData.length - 1;
    }
  }

  structuredResponses.isEntireSurveyCompleted = isEntireSurveyCompleted;

  // turn on loading state
  surveyStore.setIsSavingSurveyResponses(true);

  // call cloud function to save the survey results
  try {
    await roarfirekit.saveSurveyResponses({
      surveyData: structuredResponses,
      administrationId: selectedAdmin!,
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

    queryClient.invalidateQueries({ queryKey: ['surveyResponses', uid] });

    assignmentsStore.setHomeRefresh();
    router.push({ name: 'Home' });
  } catch (error: unknown) {
    surveyStore.setIsSavingSurveyResponses(false);
    console.error(error);
    toast.add({
      severity: 'error',
      summary: 'Error saving survey responses: ' + (error instanceof Error ? error.message : String(error)),
      life: 3000,
    });
  } finally {
    // Ensure loading state is turned off even if there's an error
    surveyStore.setIsSavingSurveyResponses(false);
  }
}

export type { RoarFirekit as RoarfirekitType } from '@bdelab/roar-firekit';

export const getPlainSurveyData = (raw: unknown) => {
  return typeof structuredClone === 'function' ? structuredClone(toRaw(raw)) : JSON.parse(JSON.stringify(toRaw(raw)));
};
