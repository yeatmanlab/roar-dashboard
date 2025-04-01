import axios from 'axios';
import _merge from 'lodash/merge';
import { BufferLoader, AudioContext } from '@/helpers/audio';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';

interface AudioLinkMap {
  [locale: string]: {
    [fileName: string]: string;
  };
}

interface SurveyResponse {
  administrationId: string;
  general: {
    responses: any;
  };
  specific: Array<{
    responses: any;
  }>;
  pageNo: number;
}

interface SurveyStore {
  isGeneralSurveyComplete: boolean;
  specificSurveyRelationIndex: number;
}

interface SurveyInstance {
  data: any;
  currentPageNo: number;
}

interface FinishedLoadingParams {
  bufferList: AudioBuffer[];
  parsedLocale: string;
  setSurveyAudioLoading: (loading: boolean) => void;
  setSurveyAudioPlayerBuffers: (locale: string, buffers: AudioBuffer[]) => void;
}

interface FetchBufferParams {
  parsedLocale: string;
  setSurveyAudioLoading: (loading: boolean) => void;
  audioLinks: AudioLinkMap;
  surveyAudioBuffers: { [locale: string]: AudioBuffer[] };
  setSurveyAudioPlayerBuffers: (locale: string, buffers: AudioBuffer[]) => void;
}

interface ShowAndPlaceAudioButtonParams {
  playAudioButton: HTMLElement | null;
  el: HTMLElement;
}

interface RestoreSurveyDataParams {
  surveyInstance: SurveyInstance;
  uid: string;
  selectedAdmin: string;
  surveyResponsesData: SurveyResponse[];
  surveyStore: SurveyStore;
}

interface SaveSurveyDataParams {
  survey: SurveyInstance;
  roarfirekit: any;
  uid: string;
  selectedAdmin: string;
  questionName: string;
  responseValue: any;
  specificIds: string[];
  userType: string;
  surveyStore: SurveyStore;
}

const context = new AudioContext();

export const fetchAudioLinks = async (surveyType: string): Promise<AudioLinkMap> => {
  const response = await axios.get('https://storage.googleapis.com/storage/v1/b/road-dashboard/o/');
  const files = response.data || { items: [] };
  const audioLinkMap: AudioLinkMap = {};
  files.items.forEach((item: any) => {
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

export function getParsedLocale(locale: string): string {
  return (locale || '').split('-')?.[0] || 'en';
}

function finishedLoading({ bufferList, parsedLocale, setSurveyAudioLoading, setSurveyAudioPlayerBuffers }: FinishedLoadingParams): void {
  setSurveyAudioPlayerBuffers(parsedLocale, bufferList);
  setSurveyAudioLoading(false);
}

export const fetchBuffer = ({ parsedLocale, setSurveyAudioLoading, audioLinks, surveyAudioBuffers, setSurveyAudioPlayerBuffers }: FetchBufferParams): void => {
  if (surveyAudioBuffers[parsedLocale]) {
    return;
  }
  setSurveyAudioLoading(true);
  const bufferLoader = new BufferLoader(context, audioLinks[parsedLocale], (bufferList) =>
    finishedLoading({ bufferList, parsedLocale, setSurveyAudioLoading, setSurveyAudioPlayerBuffers })
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

export function restoreSurveyData({ surveyInstance, uid, selectedAdmin, surveyResponsesData, surveyStore }: RestoreSurveyDataParams): { isRestored: boolean; pageNo: number } {
  const prevData = window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`);
  if (prevData) {
    const parsedData = JSON.parse(prevData);
    surveyInstance.data = parsedData.responses;
    surveyInstance.currentPageNo = parsedData.pageNo;
    return { isRestored: true, pageNo: parsedData.pageNo };
  } else if (surveyResponsesData) {
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
  surveyStore
}: SaveSurveyDataParams): void {
  const currentPageNo = survey.currentPageNo;

  if (window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`)) {
    const prevData = JSON.parse(window.localStorage.getItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`) || '{}');
    const newData = {
      responses: _merge({}, prevData.responses, { [questionName]: responseValue }),
      pageNo: currentPageNo
    };
    window.localStorage.setItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`, JSON.stringify(newData));
  } else {
    const newData = {
      responses: { [questionName]: responseValue },
      pageNo: currentPageNo
    };
    window.localStorage.setItem(`${LEVANTE_SURVEY_RESPONSES_KEY}-${uid}`, JSON.stringify(newData));
  }
} 