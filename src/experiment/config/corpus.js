/* eslint-disable import/no-mutable-exports */
import i18next from 'i18next';
// eslint-disable-next-line import/no-duplicates
import '../i18n';
// eslint-disable-next-line import/no-duplicates
import { wordlist } from '../i18n';
import { shuffle, splitList, splitList2, shuffleBlocks, combineLists } from '../helperFunctions';

export const processCSV = (userMode) => {
  const csvAssets = {
    practice: wordlist[i18next.language].dataPracticeURL,
    validated: wordlist[i18next.language].dataValidatedURL,
    new: wordlist[i18next.language].dataNewURL,
    newEasy: wordlist[i18next.language].dataNewEasyURL,
    experimental: wordlist[i18next.language].dataValidatedURL2,
  };

  const transformCSV = (csvInput, isPractice) =>
    csvInput.reduce((accum, row) => {
      const newRow = {
        stimulus: row.word,
        correct_response: row.realpseudo === 'real' ? 'ArrowRight' : 'ArrowLeft',
        a: parseFloat(row.a),
        difficulty: isPractice ? parseFloat(row.difficulty) : parseFloat(row.b),
        c: parseFloat(row.c),
        d: parseFloat(row.d),
        corpus_src: isPractice ? row.block : row.corpusId,
        realpseudo: row.realpseudo,
      };
      accum.push(newRow);
      return accum;
    }, []);

  const createRandomItemsBasedMode = (list) => {
    let numItems;
    if (userMode === 'shortRandom') {
      numItems = 25;
    } else if (userMode === 'shortRandom80') {
      numItems = 5;
    } else {
      // fullRandom
      numItems = 40;
    }
    const randomReal = list.filter((row) => row.realpseudo === 'real').slice(0, numItems);
    const randomPseudo = list.filter((row) => row.realpseudo === 'pseudo').slice(0, numItems);
    return randomReal.concat(randomPseudo);
  };

  const createLngBasedWordList = (lng, list) => {
    // if (lng === 'es') {
    // const core = list.filter((row) => row.corpus_src === 'spanish-core');
    // const random = shuffle(list.filter((row) => row.corpus_src === 'spanish-random'));
    // const randomAdjusted = createRandomItemsBasedMode(random);
    // return shuffle(core.concat(randomAdjusted));
    // }
    if (lng === 'it') {
      const core = list.filter((row) => row.corpus_src === 'italian-core');
      const random = shuffle(list.filter((row) => row.corpus_src === 'italian-random'));
      const randomAdjusted = createRandomItemsBasedMode(random);
      return shuffle(core.concat(randomAdjusted));
    }
    if (lng === 'pt') {
      const core = list.filter((row) => row.corpus_src === 'portuguese-core');
      // const random = shuffle(list.filter((row) => row.corpus_src === 'portuguese-random'));
      // const randomReal = random.filter((row) => row.realpseudo === 'real').slice(0, 50);
      // const randomPseudo = random.filter((row) => row.realpseudo === 'pseudo').slice(0, 50);
      return shuffle(core);
    }
    if (lng === 'de') {
      const core = list.filter((row) => row.corpus_src === 'german-core');
      const random = shuffle(list.filter((row) => row.corpus_src === 'german-random'));
      const randomAdjusted = createRandomItemsBasedMode(random);
      return shuffle(core.concat(randomAdjusted));
    }
    // default: english
    return transformCSV(csvAssets.validated, false);
  };

  const csvTransformed = {
    practice: transformCSV(csvAssets.practice, true),
    validated: createLngBasedWordList(i18next.language, transformCSV(csvAssets.validated)),
    new: i18next.language === 'en' ? shuffle(transformCSV(csvAssets.new, false)) : [],
    newEasy: i18next.language === 'en' ? shuffle(transformCSV(csvAssets.newEasy, false)) : [],
    experimental: createLngBasedWordList(i18next.language, transformCSV(csvAssets.validated)),
  };

  const corpusAll = {
    name: 'corpusAll',
    corpus_pseudo: csvTransformed.validated.filter((row) => row.realpseudo === 'pseudo'),
    corpus_real: csvTransformed.validated.filter((row) => row.realpseudo === 'real'),
  };

  const corpusExperimental = {
    name: 'corpusExperimental',
    corpus_pseudo: csvTransformed.experimental.filter((row) => row.realpseudo === 'pseudo'),
    corpus_real: csvTransformed.experimental.filter((row) => row.realpseudo === 'real'),
  };

  const corpusOriginal = {
    name: 'corpusOriginal',
    corpus_pseudo: csvTransformed.validated.filter(
      (row) => row.realpseudo === 'pseudo' && row.corpus_src === 'en-validated-v1',
    ),
    corpus_real: csvTransformed.validated.filter(
      (row) => row.realpseudo === 'real' && row.corpus_src === 'en-validated-v1',
    ),
  };

  const corpusNew = {
    name: 'corpusNew',
    corpus_pseudo: csvTransformed.new.filter((row) => row.realpseudo === 'pseudo'),
    corpus_real: csvTransformed.new.filter((row) => row.realpseudo === 'real'),
  };

  const corpusNewEasy = {
    name: 'corpusNewEasy',
    corpus_pseudo: csvTransformed.newEasy.filter((row) => row.realpseudo === 'pseudo'),
    corpus_real: csvTransformed.newEasy.filter((row) => row.realpseudo === 'real'),
  };

  return {
    corpusPractice: csvTransformed.practice,
    corpusAll: corpusAll,
    corpusNew: corpusNew,
    corpusNewEasy: corpusNewEasy,
    corpusOriginal: corpusOriginal,
    corpusExperimental: corpusExperimental,
  };
};

export const getCorpusForPresentationExp = (userMode, corpus) => {
  if (userMode === 'presentationExp') {
    // 520 items, 26 items, 5 presentation time, 20 blocks
    const values2Repeat = [80, 160, 350, 700, null];

    // Create a list of 20 items with 5 of each value
    const resultList = shuffleBlocks(values2Repeat, 4);

    const pseudoList = splitList(corpus.corpus_pseudo, 20, 13, resultList);
    const realList = splitList(corpus.corpus_real, 20, 13, resultList);
    return [combineLists(pseudoList, realList), values2Repeat];
  }
  if (userMode === 'presentationExpShort') {
    const values2Repeat = [80, 160, 350, null];

    // Create a list of 20 items with 5 of each value
    const resultList = shuffleBlocks(values2Repeat, 2);

    const pseudoList = splitList(corpus.corpus_pseudo, 8, 13, resultList);
    const realList = splitList(corpus.corpus_real, 8, 13, resultList);
    return [combineLists(pseudoList, realList), values2Repeat];
  }
  if (userMode === 'presentationExp2Conditions') {
    const values2Repeat = [350, null];

    // Create a list of 20 items with 5 of each value
    const resultList = Math.random() < 0.5 ? [350, 350, null, null] : [null, null, 350, 350];

    const pseudoList = splitList2(corpus.corpus_pseudo, 4, 15, resultList);
    const realList = splitList2(corpus.corpus_real, 4, 15, resultList);
    const combinedList = combineLists(pseudoList, realList);
    return [combinedList, values2Repeat];
  }
  return [[], []];
};
