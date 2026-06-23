import { vi, describe, test, expect, beforeEach } from 'vitest';
import { wireScoreAdapter } from '../sdk/letter-firekit-facade.js';
import { RoarScores } from '../experiment/scores.js';

// Facade and lazy-callback factories — captured so tests can verify calls and
// interact with the facade object that wireScoreAdapter populates.
const mockGetFirekitCompat = vi.hoisted(() => vi.fn());
const mockMakeLazyComputedCallback = vi.hoisted(() => vi.fn());

vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getFirekitCompat: mockGetFirekitCompat,
  makeLazyComputedCallback: mockMakeLazyComputedCallback,
}));

// scores.js has heavy transitive dependencies (store2, papaparse, clowder, etc.).
// Mock the module so only the class identity matters for the factory-arg assertion.
vi.mock('../experiment/scores.js', () => {
  class MockRoarScores {}
  return { RoarScores: MockRoarScores };
});

// store2 needed by _getScoreAdapter to read config.task at adapter-retrieval time.
const sessionStore = vi.hoisted(() => ({}));
vi.mock('store2', () => {
  const session = vi.fn((key) => sessionStore[key]);
  session.get = vi.fn((key) => sessionStore[key]);
  return { default: { session } };
});

describe('wireScoreAdapter', () => {
  let mockFacade;
  let mockComputedCallback;

  beforeEach(() => {
    vi.clearAllMocks();

    // Fresh facade object per test — wireScoreAdapter assigns hooks onto it.
    mockFacade = {};
    mockComputedCallback = vi.fn();

    mockGetFirekitCompat.mockReturnValue(mockFacade);
    mockMakeLazyComputedCallback.mockReturnValue(mockComputedCallback);

    sessionStore.config = { task: 'letter' };
  });

  test('_getRawScores returns undefined before any trial is accumulated', () => {
    wireScoreAdapter();

    expect(mockFacade._getRawScores()).toBeUndefined();
  });

  test('_accumulateRawScore increments numCorrect, numIncorrect, and numAttempted', () => {
    wireScoreAdapter();

    mockFacade._accumulateRawScore('LowercaseNames', 'test', 1); // correct
    mockFacade._accumulateRawScore('LowercaseNames', 'test', 0); // incorrect
    mockFacade._accumulateRawScore('LowercaseNames', 'test', 1); // correct

    expect(mockFacade._getRawScores()).toEqual({
      LowercaseNames: {
        test: { numCorrect: 2, numIncorrect: 1, numAttempted: 3 },
      },
    });
  });

  test('_accumulateRawScore tracks multiple subtasks and stages independently', () => {
    wireScoreAdapter();

    mockFacade._accumulateRawScore('LowercaseNames', 'practice', 1);
    mockFacade._accumulateRawScore('LowercaseNames', 'test', 0);
    mockFacade._accumulateRawScore('UppercaseNames', 'test', 1);

    const raw = mockFacade._getRawScores();
    expect(raw.LowercaseNames.practice).toEqual({ numCorrect: 1, numIncorrect: 0, numAttempted: 1 });
    expect(raw.LowercaseNames.test).toEqual({ numCorrect: 0, numIncorrect: 1, numAttempted: 1 });
    expect(raw.UppercaseNames.test).toEqual({ numCorrect: 1, numIncorrect: 0, numAttempted: 1 });
  });

  test('_getScoreAdapter dispatches to toLetterScoreEntries for task=letter', () => {
    sessionStore.config = { task: 'letter' };
    wireScoreAdapter();

    const adapter = mockFacade._getScoreAdapter();

    // A composite domain with thetaEstimateRaw is letter-specific — phonics
    // composite has no theta fields, so only the letter adapter would emit this entry.
    const computed = { composite: { thetaEstimateRaw: 1.5, thetaEstimate: 1.5 } };
    const entries = adapter(computed);

    expect(entries.some((e) => e.name === 'thetaEstimateRaw')).toBe(true);
  });

  test('_getScoreAdapter dispatches to toPhonicsScoreEntries for task=phonics', () => {
    sessionStore.config = { task: 'phonics' };
    wireScoreAdapter();

    const adapter = mockFacade._getScoreAdapter();

    // subscores with cvc group is phonics-specific — the letter adapter does not
    // know the cvcCorrect field name and would not emit it.
    const computed = {
      composite: {
        totalCorrect: 5,
        subscores: { cvc: { correct: 3, attempted: 5 } },
      },
    };
    const entries = adapter(computed);

    expect(entries.some((e) => e.name === 'cvcCorrect')).toBe(true);
    expect(entries.some((e) => e.name === 'thetaEstimateRaw')).toBe(false);
  });

  test('wireScoreAdapter passes RoarScores to makeLazyComputedCallback and returns its result', () => {
    const result = wireScoreAdapter();

    expect(mockMakeLazyComputedCallback).toHaveBeenCalledWith(RoarScores);
    expect(result).toBe(mockComputedCallback);
  });
});
