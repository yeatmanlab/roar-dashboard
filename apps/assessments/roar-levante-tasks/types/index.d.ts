import { JsPsych } from 'jspsych';

export {};

declare global {
  // Per trial layout config that can be preprocessed when creating timeline
  // and validated for assets
  type LayoutConfigType = {
    playAudioOnLoad: boolean; // stimulus will play audio (nullAudio if false)
    staggered: {
      enabled: boolean;
      trialTypes: string[]; // filter for trial types, TODO: Remove this and move the logic to the task
    };
    classOverrides: {
      buttonContainerClassList: string[]; // This is where we can declare grid etc
      buttonClassList: string[]; // primary, secondary, image-large, image etc
      promptClassList: string[];
      stimulusContainerClassList: string[];
    };
    prompt: {
      enabled: boolean;
      aboveStimulus: boolean;
    };
    equalSizeStim: boolean; // TODO Remove since classes declaration can handle this
    disableButtonsWhenAudioPlaying: boolean;
    isPracticeTrial: boolean;
    isInstructionTrial: boolean;
    randomizeChoiceOrder: boolean;
    isStaggered: boolean;
    isImageButtonResponse: boolean;
    showStimImage: boolean;
    response: {
      values: string[];
      displayValues: string[];
      target: string;
      targetIndex: number;
    };
    stimText?: {
      value?: string;
      displayValue?: string;
    };
    inCorrectTrialConfig: {
      onIncorrectTrial: 'skip' | 'end';
      // Other config can be placed here
    };
    disableOkButton?: boolean; // disable the OK button until the instruction prompt ends
    blockedTrials?: boolean; // when true with CAT, advance queued sequential trials in the same block via selectNextSequentialTrial
  };

  type AudioConfigType = {
    restrictRepetition: {
      enabled: boolean;
      maxRepetitions: number;
    };
    onEnded?: Function;
  };

  type StimulusType = {
    source: string;
    block_index: number;
    task: string; // TODO: define all task types here
    item: string | number[];
    trial_type?: string;
    trialType: string;
    image: string | string[];
    answer: string | number;
    assessment_stage?: string;
    assessmentStage: string;
    chance_level?: string;
    chanceLevel: number;
    itemId: string;
    item_id?: string;
    itemUid: string;
    item_uid?: string;
    distractors: Array<string | number>;
    audioFile: string | string[];
    audio_file?: string | string[];
    requiredSelections?: number;
    required_selections?: string;
    prompt: string;
    difficulty: number | string;
    orig_item_num?: string;
    origItemNum: string;
    time_limit?: string;
    timeLimit: string;
    response_alternatives?: string;
    d?: string;
    randomize?: 'yes' | 'no' | 'at_block_level';
    trialNumber?: number;
    downex?: boolean;
    storyGroup?: number;
  };

  type MediaAssetsType = {
    images: Record<string, string>;
    audio: Record<string, string>;
    video: Record<string, string>;
  };

  type GameParamsType = Record<string, string>;
  type UserParamsType = Record<string, string>;

  interface Window {
    Cypress: any; // FIXME: Add explict type
    initJsPsych: JsPsych;
    cypressData: {
      correctAnswer: string | Array<number> | number;
    };
  }
  interface LevanteLogger {
    capture(name: string, properties?: Record<string, any>): void;
    error(error: Error | unknown, context?: Record<string, any>): void;
  }
}
