import i18next from 'i18next';
// eslint-disable-next-line import/no-duplicates
import { letters } from '../i18n';
import { shuffle } from '../helperFunctions';

// eslint-disable-next-line import/no-mutable-exports
export let corpusLetterAll;
// eslint-disable-next-line import/no-mutable-exports
export let storyActive;
// eslint-disable-next-line import/no-mutable-exports
export let corpusTypePhonics;
// eslint-disable-next-line import/no-mutable-exports
export let loadCorpus;

// Function processCVS
export function processCVS() {
  const transformLetterCSV = (csvInput, isPractice) => {
    if (!Array.isArray(csvInput)) {
      return [];
    }
    return csvInput.reduce((accum, row) => {
      const newRow = {
        target_letter: row.target,
        distractor1: row.distractor1,
        distractor2: row.distractor2,
        distractor3: row.distractor3,
        audio_filename: row.audioFile,
        difficulty: isPractice ? row.difficulty : row.b,
        corpus_src: isPractice ? row.block : row.corpusId,
        form: row.form,
        itemId: row.itemId,
        itemGroup: row.itemGroup,
        pattern: row.pattern,
      };
      accum.push(newRow);
      return accum;
    }, []);
  };

  const transformStoryCSV = (csvInput) => {
    if (!Array.isArray(csvInput)) {
      return [];
    }

    return csvInput.reduce((accum, row) => {
      const newRow = {
        label: row.label,
        screenStyle: row.screenStyle,
        imageName: row.imageName,
        imageAlt: row.imageAlt,
        audioName: row.audioName,
        audioLengthMs: row.audioLengthMs,
        buttonName: row.buttonName,
        duration: row.duration,
        header1: row.header1,
        text1: row.text1,
        text2: row.text2,
      };
      accum.push(newRow);
      return accum;
    }, []);
  };

  const transformStoryPhonicsCSV = (csvInput) => {
    if (!Array.isArray(csvInput)) {
      return [];
    }

    return csvInput.reduce((accum, row) => {
      const newRow = {
        label: row.label,
        screenStyle: row.screenStyle,
        imageName: row.imageName,
        imageSpeechBubble: row.imageSpeechBubble,
        imageAlt: row.imageAlt,
        audioName: row.audioName,
        audioLengthMs: row.audioLengthMs,
        header1: row.header1,
        text1: row.text1,
        text2: row.text2,
      };
      accum.push(newRow);
      return accum;
    }, []);
  };

  loadCorpus = async function load(config) {
    const csvAssets = {
      letters: letters[i18next.language].letterNameLower || [],
      lettersUpper: letters[i18next.language].letterNameUpper || [],
      letterPractice: letters[i18next.language].letterNamePractice || [],
      letterPhoneme: letters[i18next.language].letterPhoneme || [],
      letterPhonemePractice: letters[i18next.language].letterPhonemePractice || [],
      letterTextSoundPseudo: letters[i18next.language].letterTextSoundPseudo || [],
      storyLion: letters[i18next.language].storyLion || [],
      storyLionAge12: letters[i18next.language].storyLionAge12 || [],
      storyPhonics: letters[i18next.language].storyPhonics || [],
      practicePhonics: letters[i18next.language].practicePhonics || [],
    };

    const csvTransformed = {
      letters: shuffle(transformLetterCSV(csvAssets.letters, false)),
      lettersUpper: shuffle(transformLetterCSV(csvAssets.lettersUpper, false)),
      lettersPractice: transformLetterCSV(csvAssets.letterPractice, false),
      lettersPhoneme: shuffle(transformLetterCSV(csvAssets.letterPhoneme, false)),
      lettersPhonemePractice: transformLetterCSV(csvAssets.letterPhonemePractice, false),
      storyROARLion: transformStoryCSV(csvAssets.storyLion),
      storyROARLionAge12: transformStoryCSV(csvAssets.storyLionAge12),
      storyPhonics: transformStoryPhonicsCSV(csvAssets.storyPhonics),
      phonicsPractice: transformLetterCSV(csvAssets.practicePhonics),
      lettersTextSoundPseudo: shuffle(transformLetterCSV(csvAssets.letterTextSoundPseudo, false)),
    };

    // Letter Names -- Lowercase
    corpusLetterAll = {
      name: 'corpusLetterAll',
      corpusLetterLower: csvTransformed.letters,
      corpusLetterUpper: csvTransformed.lettersUpper,
      corpusLetterPractice: csvTransformed.lettersPractice,
      corpusLetterPhoneme: csvTransformed.lettersPhoneme,
      corpusLetterPhonemePractice: csvTransformed.lettersPhonemePractice,
      corpusPhonicsPractice: csvTransformed.phonicsPractice,
      corpusPhonicsAll: csvTransformed.lettersTextSoundPseudo,

      corpusPhonicsSetA: csvTransformed.lettersTextSoundPseudo.filter(
        (item) => item.form === 'common' || item.form === 'A',
      ),

      corpusPhonicsSetB: csvTransformed.lettersTextSoundPseudo.filter(
        (item) => item.form === 'common' || item.form === 'B',
      ),

      corpusPhonicsSetC: csvTransformed.lettersTextSoundPseudo.filter(
        (item) => item.form === 'common' || item.form === 'C',
      ),
    };

    function chooseStory() {
      const { userMetadata, task } = config;
      const { grade } = userMetadata;

      if (task === 'phonics') {
        return csvTransformed.storyPhonics;
      }

      if (!Number.isNaN(Number(grade)) && Number(grade) >= 2) {
        return csvTransformed.storyROARLionAge12;
      }

      return csvTransformed.storyROARLion;
    }

    // Introduction & Story
    const storyAll = {
      name: 'corpusStory',
      corpusStory: chooseStory(),
    };
    // Future: set storyActive to the desired story
    storyActive = storyAll.corpusStory;

    function setCorpusTypePhonics() {
      const { task, phonicsSet } = config;

      // return must match one of the keys in corpusLetterAll
      if (task !== 'phonics') {
        // other tasks
        return null;
      }

      switch (phonicsSet.toUpperCase()) {
        case 'A':
          return 'corpusPhonicsSetA';

        case 'B':
          return 'corpusPhonicsSetB';

        case 'C':
          return 'corpusPhonicsSetC';

        case 'ALL':
        default:
          return 'corpusPhonicsAll';
      }
    }

    // select corpus
    corpusTypePhonics = setCorpusTypePhonics();
  };
}
