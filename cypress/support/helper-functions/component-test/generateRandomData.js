import data from '../../../fixtures/component/roar-data-table/data.js';
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

const supportLevelColors = {
  above: 'green',
  Green: 'green',
  some: '#edc037',
  Yellow: '#edc037',
  below: '#c93d82',
  Pink: '#c93d82',
  Optional: '#03befc',
  Assessed: '#A4DDED',
  Unreliable: '#d6b8c7',
};
const reliabilityFlags = [
  { accuracyTooLow: 'Accuracy Too Low' },
  { responseTimeTooFast: 'Response Time Too Fast' },
  { notEnoughResponses: 'Not Enough Responses' },
];

const progressLevels = ['Assigned', 'Started', 'Completed'];

let generateRandomData = [];

function getRandomSupportLevel() {
  return supportLevels[Math.floor(Math.random() * supportLevels.length)];
}

function getRandomOtherSupportLevel() {
  return otherSupportLevels[Math.floor(Math.random() * otherSupportLevels.length)];
}

function getSupportLevelColor(supportLevel) {
  return supportLevelColors[supportLevel];
}

function getOtherSupportLevelColor(otherSupportLevel) {
  return supportLevelColors[otherSupportLevel];
}

function getRandomReliabilityFlags() {
  const flagsArray = reliabilityFlags.filter(() => Math.random() > 0.5);
  return Object.assign({}, ...flagsArray);
}

function shouldAssignEngagementFlags() {
  return Math.random() > 0.75;
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
    rawScore: rawScore,
    standardScore: standardScore,
    percentile: percentile,
    numAttempted: numAttempted,
    numCorrect: numCorrect,
    percentCorrect: percentCorrect,
    difference: difference,
  };
}

function getRandomProgressLevel() {
  return progressLevels[Math.floor(Math.random() * progressLevels.length)];
}

for (const dataObj of data) {
  for (const score of Object.values(dataObj.scores)) {
    const { supportLevel, tagColor, tag } = supportLevelsMap[getRandomSupportLevel()];
    const { tag: otherTag, tagColor: otherTagColor } = otherSupportLevelsMap[getRandomOtherSupportLevel()];

    score.supportLevel = supportLevel;
    score.tags += `Required Reliable ${getRandomProgressLevel()} ${tag}`;

    // Randomly assign other support levels, adjust tags and colors accordingly
    if (Math.random() > 0.5) {
      score.tags += ` ${otherTag}`;
      score.tagColor = otherTagColor;
    } else {
      score.tagColor = tagColor;
    }

    score.optional = score.tags.includes('Optional');
    if (!score.optional) {
      score.tags = score.tags.replace('Required', '');
    }

    if (score.tags.includes('Unreliable')) {
      score.engagementFlags = getRandomReliabilityFlags();
    } else {
      score.reliable = true;
      score.tags = score.tags.replace('Reliable', '');
    }

    // Strip any leading or trailing whitespace
    score.tags.trim();

    const randomScore = getRandomScore();
    score['rawScore'] = randomScore.rawScore;
    score['standardScore'] = randomScore.standardScore;
    score['percentile'] = randomScore.percentile;
    score['numAttempted'] = randomScore.numAttempted;
    score['numCorrect'] = randomScore.numCorrect;
    score['correctIncorrectDifference'] = randomScore.difference;
    score['percentCorrect'] = randomScore.percentCorrect;
  }
  generateRandomData.push(dataObj);
}

const fileTemplate = `const dataRandomized = ${JSON.stringify(generateRandomData)}; export default dataRandomized;`;

fs.writeFile('./dataRandomized.js', fileTemplate, (err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('File has been created');
});
