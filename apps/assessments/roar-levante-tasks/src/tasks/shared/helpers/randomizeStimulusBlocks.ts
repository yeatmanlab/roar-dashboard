// This function randomizes stimulus blocks by their trial type

export function shuffleStimulusTrials(trialArray: StimulusType[]) {
  // 1. Group stimulus trials by type
  const stimulusTrialsByType: Record<string, StimulusType[]> = {};
  for (const trial of trialArray) {
    if (trial.trialType !== 'instructions' && trial.assessmentStage !== 'practice_response') {
      const trialType = trial.trialType; // Example property
      if (!stimulusTrialsByType[trialType]) {
        stimulusTrialsByType[trialType] = [];
      }
      stimulusTrialsByType[trialType].push(trial);
    }
  }

  // 2. Shuffle each group of stimulus trials
  for (const trialType in stimulusTrialsByType) {
    const shuffledGroup = shuffleArray(stimulusTrialsByType[trialType]);
    stimulusTrialsByType[trialType] = shuffledGroup;
  }

  // 3. Reintegrate shuffled stimulus trials into original array
  let index = 0;
  for (const trial of trialArray) {
    if (trial.trialType !== 'instructions' && trial.assessmentStage !== 'practice_response') {
      const trialType = trial.trialType;
      trialArray[index] = stimulusTrialsByType[trialType].shift() as StimulusType;
    }
    index++;
  }

  return trialArray;
}

export function shuffleArray(array: StimulusType[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
