export const games = [
  {
    name: 'ROAR - Picture Vocabulary',
    id: 'vocab',
    startBtn: '.jspsych-btn',
    introBtn: '.continue',
    introIters: 3,
    numChoices: 3,
    stimulus: '',
    preChoiceDelay: 700,
    setUpChoice: '.intro_aliens',
    clickableItem: '.vocab_img',
    numIter: 4,
  },
  {
    name: 'ROAR - Written Vocabulary',
    id: 'cva',
    startBtn: '.jspsych-btn',
    introBtn: '.go-button',
    introIters: 3,
    setupChoice: '',
    stimulus: '.item-stimulus-cva',
    preChoiceDelay: 1700,
    clickableItem: 'button',
    correctChoice: '.glowingButton',
    numIter: 9,
  },
  {
    name: 'ROAR - Morphology',
    id: 'morphology',
    startBtn: '.jspsych-btn',
    introBtn: '.go-button',
    introIters: 3,
    numChoices: 3,
    stimulus: '.item-stimulus',
    clickableItem: 'button',
    preChoiceDelay: 1500,
    setupChoice: '',
    correctChoice: '.glowingButton',
    numIter: 6,
  },
  {
    name: 'ROAR - Letter',
    id: 'letter',
    startBtn: '.jspsych-btn',
    introBtn: '.go-button',
    introIters: 5,
    correctChoice: '.glowingButton',
    numChoices: 3,
    stimulus: '',
    setupChoice: '',
    clickableItem: 'button',
    preChoiceDelay: 600,
    numIter: 27,
  },
];

// variant IDS
// vocab: VimH8oXM99UToXydiDK4
// cva: 5OaEGDBHAxU4kSebvyix
// letter: E89L0yam9SJ9g5vDFzzr
// multichoice: UD9GC7PkVRX8oJvqysTL
