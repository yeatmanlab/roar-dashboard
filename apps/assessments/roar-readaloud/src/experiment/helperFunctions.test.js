import { describe, it, expect, vi, beforeEach } from 'vitest';

// helperFunctions imports `writeTrial` from the SDK compat at module load. Mock it so these
// tests exercise the pure stage-normalization logic (and writeReadaloudTrial's forwarding)
// without needing the built SDK or the network. `vi.hoisted` exposes the mock fn to the
// hoisted `vi.mock` factory.
const { writeTrialMock } = vi.hoisted(() => ({ writeTrialMock: vi.fn() }));
vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  writeTrial: writeTrialMock,
}));

import { normalizeAssessmentStage, writeReadaloudTrial } from './helperFunctions';

describe('normalizeAssessmentStage', () => {
  it('maps the real trial stages to themselves', () => {
    expect(normalizeAssessmentStage('practice')).toBe('practice');
    expect(normalizeAssessmentStage('test')).toBe('test');
  });

  it('is case-insensitive — view labels arrive capitalized (Practice / Test)', () => {
    expect(normalizeAssessmentStage('Practice')).toBe('practice');
    expect(normalizeAssessmentStage('TEST')).toBe('test');
  });

  it('routes calibration / device-setup labels to practice_response', () => {
    expect(normalizeAssessmentStage('eyeCalibration')).toBe('practice_response');
    expect(normalizeAssessmentStage('headCalibration')).toBe('practice_response');
    expect(normalizeAssessmentStage('crowding')).toBe('practice_response');
  });

  it('routes unknown / empty / nullish stages to practice_response', () => {
    expect(normalizeAssessmentStage('something-else')).toBe('practice_response');
    expect(normalizeAssessmentStage('')).toBe('practice_response');
    expect(normalizeAssessmentStage(null)).toBe('practice_response');
    expect(normalizeAssessmentStage(undefined)).toBe('practice_response');
  });
});

describe('writeReadaloudTrial', () => {
  beforeEach(() => {
    writeTrialMock.mockReset();
    writeTrialMock.mockResolvedValue(undefined);
  });

  it('forwards the trial with a normalized assessment_stage and preserves the original label as stageLabel', async () => {
    await writeReadaloudTrial({ assessment_stage: 'Test', correct: 1, item: 'foo' });

    expect(writeTrialMock).toHaveBeenCalledTimes(1);
    expect(writeTrialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assessment_stage: 'test',
        stageLabel: 'Test',
        correct: 1,
        item: 'foo',
      }),
    );
  });

  it('normalizes calibration labels while keeping the original label queryable via stageLabel', async () => {
    await writeReadaloudTrial({ assessment_stage: 'eyeCalibration', correct: 1 });

    expect(writeTrialMock).toHaveBeenCalledWith(
      expect.objectContaining({ assessment_stage: 'practice_response', stageLabel: 'eyeCalibration' }),
    );
  });

  it('swallows writeTrial failures so the fire-and-forget call never rejects', async () => {
    writeTrialMock.mockRejectedValueOnce(new Error('backend down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(writeReadaloudTrial({ assessment_stage: 'practice', correct: 1 })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
