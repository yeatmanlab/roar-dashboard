export type LayoutConfigTypeInference = {
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
    useStimText?: boolean;
  };
  equalSizeStim: boolean; // TODO Remove since classes declaration can handle this
  disableButtonsWhenAudioPlaying: boolean;
  isPracticeTrial: boolean;
  isInstructionTrial: boolean;
  randomizeChoiceOrder: boolean;
  isStaggered: boolean;
  isImageButtonResponse: boolean;
  showStimImage: boolean;
  story: string;
  storyId: string;
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
};
