// ********************
// This function will randomize the data in the dataTemplate.js file and write it to a new file called dataRandomized.js.
// Run this function to generate test data which can be used with various Cypress component tests.
// ********************

import dataTemplate from '../../../fixtures/component/roar-data-table/dataTemplate.js';
import fs from 'fs';

const supportLevels = ['above', 'some', 'below'];
const supportLevelsMap = {
  above: { supportLevel: 'Achieved Skill', tagColor: 'green', tag: 'Green' },
  some: { supportLevel: 'Developing Skill', tagColor: '#edc037', tag: 'Yellow' },
  below: { supportLevel: 'Needs Extra Support', tagColor: '#c93d82', tag: 'Pink' },
};

const otherSupportLevels = ['Optional', 'Assessed', 'Unreliable'];
const otherSupportLevelsMap = {
  Optional: { tagColor: '#03befc', tag: 'Optional' },
  Assessed: { tagColor: '#A4DDED', tag: 'Assessed' },
  Unreliable: { tagColor: '#d6b8c7', tag: 'Unreliable' },
};

const reliabilityFlags = [
  { accuracyTooLow: 'Accuracy Too Low' },
  { responseTimeTooFast: 'Response Time Too Fast' },
  { notEnoughResponses: 'Not Enough Responses' },
];

const progressLevels = ['Assigned', 'Started', 'Completed'];
const schoolNames = ['Birch Test School', 'Cypress Test School', 'Maple Test School', 'Oak Test School'];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomSupportLevel() {
  return getRandomElement(supportLevels);
}

function getRandomOtherSupportLevel() {
  return getRandomElement(otherSupportLevels);
}

function getRandomReliabilityFlags() {
  const flagsArray = reliabilityFlags.filter(() => Math.random() > 0.5);
  return Object.assign({}, ...flagsArray);
}

function getRandomScore() {
  const rawScore = Math.floor(Math.random() * 301);
  const standardScore = Math.floor(Math.random() * 301) + 1;
  const percentile = Math.floor(Math.random() * 101);
  const numAttempted = Math.floor(Math.random() * 100) + 1;
  const numCorrect = Math.floor(Math.random() * (numAttempted + 1));
  const percentCorrect = Math.floor((numCorrect / numAttempted) * 100);
  const difference = numAttempted - numCorrect;
  return {
    rawScore,
    standardScore,
    percentile,
    numAttempted,
    numCorrect,
    percentCorrect,
    difference,
  };
}

function getRandomProgressLevel() {
  return getRandomElement(progressLevels);
}

function randomizeName(name) {
  return `${name} ${Math.floor(1000000000 + Math.random() * 9000000000)}`;
}

function randomizeData(dataTemplate) {
  return dataTemplate.map((dataObj) => {
    dataObj.user.firstName = randomizeName('Test');
    dataObj.user.lastName = randomizeName('User');
    dataObj.user.schoolName = getRandomElement(schoolNames);

    for (const score of Object.values(dataObj.scores)) {
      const { supportLevel, tagColor, tag } = supportLevelsMap[getRandomSupportLevel()];
      const { tag: otherTag, tagColor: otherTagColor } = otherSupportLevelsMap[getRandomOtherSupportLevel()];

      score.supportLevel = supportLevel;
      score.tags += `Required Reliable ${getRandomProgressLevel()} ${tag}`;

      if (Math.random() > 0.5) {
        score.tags += ` ${otherTag}`;
        score.tagColor = otherTagColor;
      } else {
        score.tagColor = tagColor;
      }

      score.optional = score.tags.includes('Optional');
      if (score.optional) {
        score.tags = score.tags.replace('Required', '');
      }

      if (score.tags.includes('Unreliable')) {
        score.engagementFlags = getRandomReliabilityFlags();
      } else {
        score.reliable = true;
        score.tags = score.tags.replace('Reliable', '');
      }

      score.tags = score.tags.trim();

      const randomScore = getRandomScore();
      Object.assign(score, randomScore);
    }
    return dataObj;
  });
}

function writeRandomizedDataToFile(data) {
  const fileTemplate = `const dataRandomized = ${JSON.stringify(data)}; export default dataRandomized;`;

  fs.writeFile('./dataRandomized.js', fileTemplate, (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('File has been created');
  });
}

const generateRandomData = randomizeData(dataTemplate);
writeRandomizedDataToFile(generateRandomData);
