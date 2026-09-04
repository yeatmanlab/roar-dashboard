import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('regenerator-runtime/runtime', () => ({}));

vi.mock('../../taskStore', () => ({
  taskStore: vi.fn(),
}));

vi.mock('../taskSetup', () => ({
  jsPsych: {},
  initializeCat: vi.fn(),
  initializeClowder: vi.fn().mockResolvedValue(undefined),
  setNextStimulus: vi.fn(),
  clowder: { remainingItems: [] },
}));

vi.mock('../shared/helpers', () => ({
  initTrialSaving: vi.fn(),
  initTimeline: vi.fn(() => ({})),
  createPreloadTrials: vi.fn(() => ({ default: {} })),
  convertItemToString: vi.fn((item: any) => String(item)),
  shouldUseClowder: vi.fn(() => true),
  createValidityEvaluator: vi.fn(() => vi.fn()),
}));

vi.mock('./trials/instructions', () => ({
  instructions: [],
}));

vi.mock('../shared/trials', () => ({
  exitFullscreen: {},
  setupStimulus: {},
  taskFinished: vi.fn(() => ({})),
  enterFullscreen: {},
  finishExperiment: {},
}));

vi.mock('./trials/afcInference', () => ({
  afcStimulusInference: vi.fn(() => ({})),
}));

vi.mock('./helpers/config', () => ({
  getLayoutConfig: vi.fn(() => ({ itemConfig: {}, errorMessages: [] })),
}));

vi.mock('../shared/trials/repeatInstructions', () => ({
  repeatInstructionsMessage: {},
}));

import { taskStore } from '../../taskStore';
import { setNextStimulus, clowder } from '../taskSetup';
import buildRoarInferenceTimeline from './timeline';

describe('buildRoarInferenceTimeline - clowder loop_function', () => {
  let mockTaskStoreData: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTaskStoreData = {
      corpora: { stimulus: [] },
      translations: {},
      nextStimulus: undefined,
    };

    (taskStore as any).mockImplementation((key?: string, value?: any) => {
      if (key === undefined) return mockTaskStoreData;
      if (value !== undefined) {
        mockTaskStoreData[key] = value;
        return value;
      }
      return mockTaskStoreData[key];
    });

    (clowder as any).remainingItems = [];
  });

  it('passes all items sharing the same itemId (but with different other ids) as additionalItemsToRemove', async () => {
    // Simulate having just seen an item with itemId 'item-A'. The remaining corpus
    // still contains two other unique variants of that same item (same itemId,
    // different id and other fields). Both must be queued for removal so the
    // participant never sees the same item again in a different form.
    // An unrelated item ('item-B') must not be included.
    const seenItemVariant1 = { id: 'trial-1', itemId: 'item-A', difficulty: 0.5 };
    const seenItemVariant2 = { id: 'trial-2', itemId: 'item-A', difficulty: 1.2 };
    const unrelatedItem = { id: 'trial-3', itemId: 'item-B', difficulty: 0.8 };

    (clowder as any).remainingItems = [seenItemVariant1, seenItemVariant2, unrelatedItem];
    mockTaskStoreData.nextStimulus = { itemId: 'item-A' };

    const { timeline } = await buildRoarInferenceTimeline({ task: 'test' }, {} as any);

    // timeline = [preloadTrials, initialTimeline, testBlock, taskFinished(), exitFullscreen]
    // (instructions is [] so no spread elements between initialTimeline and testBlock)
    const testBlock = timeline[2];

    // Clear the initial setNextStimulus({ ignorePreviousItem: true }) call
    vi.mocked(setNextStimulus).mockClear();

    testBlock.loop_function();

    expect(setNextStimulus).toHaveBeenCalledWith({
      additionalItemsToRemove: [seenItemVariant1, seenItemVariant2],
    });
  });
});
