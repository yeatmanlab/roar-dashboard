import { acceptHMRUpdate, defineStore } from 'pinia';
import { parse, stringify } from 'zipson';

// Define interfaces (use 'any' for complex/unknown types initially)
interface SurveyState {
  requireRefresh: boolean;
  survey: any | null; // Replace 'any' with the actual Survey type if available
  numGeneralPages: number;
  numSpecificPages: number;
  currentSurveyAudioSource: any | null; // Replace 'any' if a specific type exists (e.g., AudioBufferSourceNode)
  isSavingSurveyResponses: boolean;
  surveyAudioPlayerBuffers: { [key: string]: any }; // Replace 'any' with the actual buffer type
  surveyAudioLoading: boolean;
  allSurveyPages: any[]; // Replace 'any' with the actual Page type
  allSpecificPages: any[]; // Replace 'any' with the actual Page type
  currentPageIndex: number;
  specificSurveyRelationData: any[]; // Replace 'any' with the actual relation data type
  specificSurveyRelationIndex: number;
  isGeneralSurveyComplete: boolean;
  isSpecificSurveyComplete: boolean;
  isSurveyCompleted: boolean;
  audioLinkMap: { [key: string]: string }; // Assuming it maps string keys to string URLs
}

// Define the serializer type (basic structure)
interface Serializer {
  deserialize: (value: string) => any;
  serialize: (value: any) => string;
}

export const useSurveyStore = defineStore('surveyStore', {
  state: (): SurveyState => ({
    requireRefresh: false,
    survey: null,
    numGeneralPages: 0,
    numSpecificPages: 0,
    currentSurveyAudioSource: null,
    isSavingSurveyResponses: false,
    surveyAudioPlayerBuffers: {},
    surveyAudioLoading: false,
    allSurveyPages: [],
    allSpecificPages: [],
    currentPageIndex: 0,
    specificSurveyRelationData: [],
    specificSurveyRelationIndex: 0,
    isGeneralSurveyComplete: false,
    isSpecificSurveyComplete: false,
    isSurveyCompleted: false,
    audioLinkMap: {},
  }),
  actions: {
    requireHomeRefresh(): void {
      this.requireRefresh = true;
    },
    setSurveyCompleted(): void {
      this.isSurveyCompleted = true;
    },
    setSurvey(survey: any): void { // Replace 'any' with Survey type
      this.survey = survey;
    },
    setNumberOfSurveyPages(numGeneralPages: number, numSpecificPages: number): void {
      this.numGeneralPages = numGeneralPages;
      this.numSpecificPages = numSpecificPages;
    },
    setCurrentSurveyAudioSource(audioSource: any | null): void { // Replace 'any'
      this.currentSurveyAudioSource = audioSource;
    },
    setIsSavingSurveyResponses(isSaving: boolean): void {
      this.isSavingSurveyResponses = isSaving;
    },
    setSurveyAudioPlayerBuffers(parsedLocale: string, bufferList: any): void { // Replace 'any'
      this.surveyAudioPlayerBuffers[parsedLocale] = bufferList;
    },
    setSurveyAudioLoading(loading: boolean): void {
      this.surveyAudioLoading = loading;
    },
    setAllSurveyPages(pages: any[]): void { // Replace 'any'
      this.allSurveyPages = pages;
    },
    setAllSpecificPages(pages: any[]): void { // Replace 'any'
      this.allSpecificPages = pages;
    },
    // Out of the total pages, the current page index is the index of the page that is currently being displayed
    setCurrentPageIndex(index: number): void {
      this.currentPageIndex = index;
    },
    setSpecificSurveyRelationData(data: any[]): void { // Replace 'any'
      this.specificSurveyRelationData = data;
    },
    setSpecificSurveyRelationIndex(index: number): void {
      this.specificSurveyRelationIndex = index;
    },
    setIsGeneralSurveyComplete(isComplete: boolean): void {
      this.isGeneralSurveyComplete = isComplete;
    },
    setIsSpecificSurveyComplete(isComplete: boolean): void {
      this.isSpecificSurveyComplete = isComplete;
    },
    setAudioLinkMap(map: { [key: string]: string }): void {
      this.audioLinkMap = map;
    },
  },
  persist: {
    storage: sessionStorage,
    debug: false,
    serializer: {
      deserialize: parse,
      serialize: stringify,
    } as Serializer, // Cast to ensure compatibility
  },
});

// HMR (Hot Module Replacement)
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSurveyStore, import.meta.hot));
} 