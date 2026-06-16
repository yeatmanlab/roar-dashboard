import i18next from 'i18next';
 
import '../i18n';
 
import enCorpusPractice from '../corpus/en/practice-sentences.csv';
import enCorpusLab from '../corpus/en/sre-lab-sentence-id-lookup.csv';
import enCorpusTOSREC from '../corpus/en/sre-tosrec-sentence-id-lookup.csv';
import enCorpusAI from '../corpus/en/sre-ai-sentence-id-lookup.csv';
import enCorpusAIV1P1 from '../corpus/en/sre-ai-parallel-v1-p1.csv';
import enCorpusAIV1P2 from '../corpus/en/sre-ai-parallel-v1-p2.csv';
import enCorpusAIV2Testset from '../corpus/en/sre-ai-parallel-testset-v1.csv';
import enCorpusAIV3Forms from '../corpus/en/sre-ai-parallel-v3.csv';
import esCorpusPractice from '../corpus/es/practice-sentences.csv';
import esCorpusTest from '../corpus/es/esp-sre-combined-sentence-id-lookup.csv';
import esCorpusFixedForms from '../corpus/es/esp-sre-v2-fixed-forms.csv';
import ptCorpusPractice from '../corpus/pt/practice-senteces.csv';
import ptCorpusTest from '../corpus/pt/sre-combined-sentence-id-lookup.csv';
import deCorpusPractice from '../corpus/de/practice-sentences-de.csv';
import deCorpusTest from '../corpus/de/sre-combined-sentence-id-lookup-de.csv';
import { shuffle } from '../experimentHelpers';

 
export let corpus = {};

export function processCSV() {
  const sentenceList = {
    en: {
      corpusPractice: enCorpusPractice,
      corpusLab: enCorpusLab,
      corpusTOSREC: enCorpusTOSREC,
      corpusAI: enCorpusAI,
      corpusAIV1P1: enCorpusAIV1P1,
      corpusAIV1P2: enCorpusAIV1P2,
      corpusAIV2Testset: enCorpusAIV2Testset,
      corpusFixedForms: enCorpusAIV3Forms,
    },
    es: {
      corpusPractice: esCorpusPractice,
      corpusTest: esCorpusTest,
      corpusFixedForms: esCorpusFixedForms,
    },
    it: {
      corpusPractice: '',
      corpusLab: '',
      corpusTOSREC: '',
      corpusAI: '',
    },
    pt: {
      corpusPractice: ptCorpusPractice,
      corpusTest: ptCorpusTest,
    },
    de: {
      corpusPractice: deCorpusPractice,
      corpusTest: deCorpusTest,
    },
  };
  let csvAssets;

  const { language } = i18next;

  // add more langugaes if needed
  if (language === 'pt' || language === 'de') {
    csvAssets = {
      practice: sentenceList[i18next.language].corpusPractice,
      test: sentenceList[i18next.language].corpusTest,
    };
  } else if (language === 'es') {
    // Spanish: we have a choice to run random or run fixed forms
    csvAssets = {
      fixedforms: sentenceList[i18next.language].corpusFixedForms,
      practice: sentenceList[i18next.language].corpusPractice,
      test: sentenceList[i18next.language].corpusTest,
    };
  } else {
    // Default to English
    csvAssets = {
      practice: sentenceList[i18next.language].corpusPractice,
      lab: sentenceList[i18next.language].corpusLab,
      ai: sentenceList[i18next.language].corpusAI,
      aiV1P1: sentenceList[i18next.language].corpusAIV1P1,
      aiV1P2: sentenceList[i18next.language].corpusAIV1P2,
      aiV2Testset: sentenceList[i18next.language].corpusAIV2Testset,
      aiv3Forms: sentenceList[i18next.language].corpusFixedForms,
      tosrec: [],
    };
  }

  // function to transform .csv for practice sentences
  const transformCSVp = (csvInput) =>
    csvInput.reduce((accum, row) => {
      const newRow = {
        sentence: row.sentence,
        answer: row.answer,
        correct_response: row.correctresponse,
      };
      accum.push(newRow);
      return accum;
    }, []);

  // function to transform .csv for lab/amy's sentences + anya's ai sentences
  const transformCSVlab = (csvInput) =>
    csvInput.reduce((accum, row) => {
      const newRow = {
        sentence: row.sentence,
        direction: row.direction,
        answer: row.answer,
        difficulty: row.difficulty,
        itemId: row.itemId,
      };
      accum.push(newRow);
      return accum;
    }, []);

  // function to transform .csv for spanish test corpus
  const transformCSVespTest = (csvInput) =>
    csvInput.reduce((accum, row) => {
      const newRow = {
        sentence: row.sentence,
        direction: row.direction,
        answer: row.answer,
        difficulty: row.difficulty,
        itemId: row.itemId,
        corpusId: row.corpusId,
      };
      accum.push(newRow);
      return accum;
    }, []);

  // function to transform .csv for tosrec sentences
  const transformCSVt = (csvInput) => {
    if (!csvInput || !Array.isArray(csvInput)) {
      return [];
    }
    return csvInput.reduce((accum, row) => {
      const newRow = {
        sentence: row.sentence,
        grade: row.grade,
        direction: row.direction,
        answer: row.answer,
        itemId: row.itemId,
      };
      accum.push(newRow);
      return accum;
    }, []);
  };

  const transformCSVtestset = (csvInput) => {
    if (!csvInput || !Array.isArray(csvInput)) {
      return [];
    }
    return csvInput.reduce((accum, row) => {
      const newRow = {
        sentence: row.sentence,
        grade: row.grade,
        direction: row.direction,
        answer: row.answer,
        itemId: row.itemId,
        testsetId: parseInt(row.testsetId, 10),
      };
      accum.push(newRow);
      return accum;
    }, []);
  };

  const transformCSVfixedform = (csvInput) => {
    if (!csvInput || !Array.isArray(csvInput)) {
      return [];
    }
    return csvInput.reduce((accum, row) => {
      const newRow = {
        sentence: row.sentence,
        direction: row.direction,
        answer: row.answer,
        corpusId: row.corpusId,
        form: row.form,
        itemNum: parseInt(row.itemNum, 10),
        itemIdOld: row.itemId_old,
        itemId: row.itemId,
      };
      accum.push(newRow);
      return accum;
    }, []);
  };

  const getRandomNumbers = (n, nSelect) => {
    const numbers = new Set(); // Use a Set to store unique numbers

    // Keep generating random numbers until we have 5 unique values
    while (numbers.size < nSelect) {
      const randomNumber = Math.floor(Math.random() * n) + 1; // Generate a random number between 1 and 50
      numbers.add(randomNumber);
    }

    // Convert the Set to an Array and return it
    return [...numbers];
  };
  const formParallelTestForm = (testset, nTotal, numSets) => {
    const testsetList = getRandomNumbers(nTotal, numSets);
    const testform = [];
    testsetList.forEach((testsetId) => {
      testform.push(...testset.filter((row) => row.testsetId === testsetId));
    });

    return testform;
  };

   
  const generateLanguageSpecificCorpus = (csvAssets) => {
     
    if (language !== 'en') {
      const testCorpus = transformCSVespTest(csvAssets.test);
      const fixedCorpus = transformCSVfixedform(csvAssets.fixedforms);

      const trueSentences = shuffle(testCorpus.filter((row) => row.answer === 'TRUE' || row.answer === true));
      const falseSentences = shuffle(testCorpus.filter((row) => row.answer === 'FALSE' || row.answer === false));
      let forms = {};

      if (language === 'es') {
        const uniqueForms = [...new Set(fixedCorpus.map((item) => item.form))];
        forms = {
          practice: transformCSVp(csvAssets.practice),
          test1: shuffle([...trueSentences.slice(0, 35), ...falseSentences.slice(0, 35)]),
          test2: shuffle([...trueSentences.slice(35, 70), ...falseSentences.slice(35, 70)]),
          fixedForms: uniqueForms.reduce((acc, form, index) => {
            acc[`fixedForm${index + 1}`] = fixedCorpus.filter((row) => row.form === form);
            return acc;
          }, {}),
        };
      } else {
        forms = {
          practice: transformCSVp(csvAssets.practice),
          test1: shuffle([...trueSentences.slice(0, 35), ...falseSentences.slice(0, 35)]),
          test2: shuffle([...trueSentences.slice(35, 70), ...falseSentences.slice(35, 70)]),
        };
      }
      return forms;
    }
    const fixedCorpus = transformCSVfixedform(csvAssets.aiv3Forms);
    const uniqueForms = [...new Set(fixedCorpus.map((item) => item.form))];
    return {
      practice: transformCSVp(csvAssets.practice),
      lab: transformCSVlab(csvAssets.lab),
      ai: shuffle(transformCSVlab(csvAssets.ai)).slice(0, 130),
      aiV1P1: transformCSVlab(csvAssets.aiV1P1),
      aiV1P2: transformCSVlab(csvAssets.aiV1P2),
      aiV2: formParallelTestForm(transformCSVtestset(csvAssets.aiV2Testset), 50, 5),
      fixedForms: uniqueForms.reduce((acc, form, index) => {
        acc[`fixedForm${index + 1}`] = fixedCorpus.filter((row) => row.form === form);
        return acc;
      }, {}),
      tosrec1: transformCSVt(csvAssets.tosrec1),
      tosrec2: transformCSVt(csvAssets.tosrec2),
      tosrec3: transformCSVt(csvAssets.tosrec3),
      tosrec4: transformCSVt(csvAssets.tosrec4),
      tosrec5: transformCSVt(csvAssets.tosrec5),
      tosrec6: transformCSVt(csvAssets.tosrec6),
      tosrec7: transformCSVt(csvAssets.tosrec7),
      tosrec8: transformCSVt(csvAssets.tosrec8),
    };
  };
  corpus = generateLanguageSpecificCorpus(csvAssets);
}
