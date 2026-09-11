import { vi, describe, test, expect, beforeEach } from 'vitest';

// initTrialSaving mutates jsPsych.opts lifecycle callbacks. Provide a mock jsPsych whose opts
// we can invoke to exercise the installed on_finish / on_data_update / on_interaction handlers.
const jsPsychMock = vi.hoisted(() => ({ opts: {} }));
vi.mock('./taskSetup', () => ({ jsPsych: jsPsychMock }));

import { initTrialSaving } from './initTrialSaving';

const writableTrial = (stage, extra = {}) => ({ save_trial: true, assessment_stage: stage, ...extra });

describe('initTrialSaving', () => {
  let firekit;
  let originalOnFinish;
  let originalOnDataUpdate;

  beforeEach(() => {
    vi.clearAllMocks();
    originalOnFinish = vi.fn();
    originalOnDataUpdate = vi.fn();
    // jsPsych ships no-op lifecycle callbacks by default; `extend` wraps the existing ones.
    jsPsychMock.opts = { on_finish: originalOnFinish, on_data_update: originalOnDataUpdate };

    firekit = {
      writeTrial: vi.fn(),
      finishRun: vi.fn(),
      addInteraction: vi.fn(),
      run: { completed: false },
    };

    initTrialSaving({ firekit });
  });

  test('on_finish marks the run finished and preserves the original callback', () => {
    jsPsychMock.opts.on_finish();
    expect(firekit.finishRun).toHaveBeenCalledTimes(1);
    expect(originalOnFinish).toHaveBeenCalledTimes(1);
  });

  test('writes a trial for a writable stage, stripping save_trial and internal_node_id', () => {
    jsPsychMock.opts.on_data_update(writableTrial('test', { internal_node_id: '0.0-1', numCorrect: 1 }));

    expect(firekit.writeTrial).toHaveBeenCalledTimes(1);
    const [data, callback] = firekit.writeTrial.mock.calls[0];
    expect(data).not.toHaveProperty('save_trial');
    expect(data).not.toHaveProperty('internal_node_id');
    expect(data.numCorrect).toBe(1);
    expect(typeof callback).toBe('function');
  });

  test('accepts all four writable stages (practice/test + their _response variants)', () => {
    for (const stage of ['practice', 'practice_response', 'test', 'test_response']) {
      jsPsychMock.opts.on_data_update(writableTrial(stage));
    }
    expect(firekit.writeTrial).toHaveBeenCalledTimes(4);
  });

  test('skips non-writable stages (data / instruction / none metadata trials)', () => {
    for (const stage of ['data', 'instruction', 'none']) {
      jsPsychMock.opts.on_data_update(writableTrial(stage));
    }
    expect(firekit.writeTrial).not.toHaveBeenCalled();
  });

  test('skips trials that are not flagged save_trial', () => {
    jsPsychMock.opts.on_data_update({ assessment_stage: 'test', numCorrect: 1 });
    expect(firekit.writeTrial).not.toHaveBeenCalled();
  });

  test('guards on run.completed — no write after finishRun cleared the run', () => {
    firekit.run.completed = true;
    jsPsychMock.opts.on_data_update(writableTrial('test'));
    expect(firekit.writeTrial).not.toHaveBeenCalled();
  });

  test('falls back to the camelCase assessmentStage field', () => {
    jsPsychMock.opts.on_data_update({ save_trial: true, assessmentStage: 'test' });
    expect(firekit.writeTrial).toHaveBeenCalledTimes(1);
  });

  test('on_data_update preserves the original callback', () => {
    jsPsychMock.opts.on_data_update(writableTrial('test'));
    expect(originalOnDataUpdate).toHaveBeenCalledTimes(1);
  });

  test('on_interaction_data_update forwards the interaction to the firekit shim', () => {
    const interaction = { event: 'focus', trial: 3 };
    jsPsychMock.opts.on_interaction_data_update(interaction);
    expect(firekit.addInteraction).toHaveBeenCalledWith(interaction);
  });
});
