import { randomInteger } from './randomInteger';
import { shuffle } from './shuffleArray';

export const prepareSurveyChoices = (target, distractors) => {
  // randomly select a location for the correct answer
  const randIndex = randomInteger(0, distractors.length);

  // randomize the order of the distractors
  const stimulus = shuffle(distractors);
  let choices = [];
  for (let i = 0; i < distractors.length; i++) {
    choices.push(stimulus[i]);
  }

  // insert the target
  choices.splice(randIndex, 0, target);

  return {
    choices: choices,
    correctResponseNum: randIndex,
  };
};
