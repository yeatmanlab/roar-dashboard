import _shuffle from 'lodash/shuffle';
import { fractionToMathML } from './fractionToMathML';
import { taskStore } from '../../../taskStore';

export const prepareChoices = (
  target: string,
  distractors: string[],
  randomize: 'yes' | 'no' | 'at_block_level' | undefined,
  trialType?: string,
) => {
  let choices: string[];
  if (!target || distractors.includes(target)) {
    // If target is not present, don't add to options
    choices = [...distractors];
  } else {
    choices = [target, ...distractors]; // add target to options
  }

  // set order for yes/no options - yes should always be first
  if (JSON.stringify([...choices].sort()) === JSON.stringify(['yes', 'no'].sort())) {
    choices = ['yes', 'no'];
  }

  // apply required randomization
  switch (randomize) {
    case 'yes':
      choices = _shuffle(choices);
      break;
    case 'no':
      break;
    case 'at_block_level':
      const previousChoices = taskStore().previousChoices;

      // use previous choices if they match current choices, otherwise set new choice order
      if (
        previousChoices !== null &&
        previousChoices !== undefined &&
        JSON.stringify([...choices].sort()) === JSON.stringify([...previousChoices].sort())
      ) {
        choices = previousChoices;
      } else {
        choices = _shuffle(choices);
        taskStore('previousChoices', choices);
      }

      break;
    default:
      // randomize by default
      choices = _shuffle(choices);
      break;
  }

  const originalChoices = [...choices];
  if (trialType === 'Fraction') {
    taskStore('nonFractionSelections', choices);
    choices = choices.map((choice) => fractionToMathML(choice));
  }

  // Update session variables
  const correctResponseIdx =
    trialType === 'Fraction' ? taskStore().nonFractionSelections.indexOf(target) : choices.indexOf(target);
  taskStore('target', target);
  taskStore('correctResponseIdx', correctResponseIdx);
  taskStore('choices', choices);

  return {
    target,
    choices,
    originalChoices,
    correctResponseIdx,
  };
};
