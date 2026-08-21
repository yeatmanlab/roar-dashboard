export function getRealTrials(corpus: StimulusType[]) {
  const totalRealTrials = corpus.filter((trial: StimulusType) => {
    return trial.assessmentStage === 'test_response';
  }).length;

  return totalRealTrials;
}
