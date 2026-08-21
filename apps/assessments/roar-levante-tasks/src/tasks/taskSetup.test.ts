import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the taskStore BEFORE importing anything that uses it
vi.mock('../taskStore', () => ({
  taskStore: vi.fn(() => ({
    runCat: false,
    currentCatBlock: 0,
    task: 'trog',
    scoringVersion: 1,
  })),
}));

// Mock @bdelab/roar-utils
vi.mock('@bdelab/roar-utils', () => ({
  getDevice: vi.fn(() => 'desktop'),
}));

// Mock CLOWDER_SELECTION_CONFIG
vi.mock('./shared/helpers', () => ({
  CLOWDER_SELECTION_CONFIG: {
    trog: {
      1: {
        catOrderMap: {
          0: 'practice',
          1: 'composite',
          2: 'new',
        },
        catsToUpdate: ['composite', 'new', 'composite_comprehension'],
        catToSelect: 'composite',
      },
    },
  },
}));

import { taskStore } from '../taskStore';
import { moveToNextBlock } from './taskSetup';

describe('moveToNextBlock', () => {
  let mockTaskStoreData: Record<string, any>;

  beforeEach(() => {
    mockTaskStoreData = {
      currentCatBlock: 0,
      task: 'trog',
      scoringVersion: 1,
      runCat: false,
    };

    // Setup taskStore mock to act as getter/setter
    (taskStore as any).mockImplementation((key?: string, value?: any) => {
      if (key === undefined) {
        return mockTaskStoreData;
      }
      if (value !== undefined) {
        mockTaskStoreData[key] = value;
        return value;
      }
      return mockTaskStoreData[key];
    });
  });

  it('should increment currentCatBlock by 1 when no customIndex provided', () => {
    mockTaskStoreData.currentCatBlock = 0;
    moveToNextBlock();

    expect(mockTaskStoreData.currentCatBlock).toBe(1);
  });

  it('should handle null currentCatBlock and set to 0', () => {
    mockTaskStoreData.currentCatBlock = null;
    moveToNextBlock();

    expect(mockTaskStoreData.currentCatBlock).toBe(0);
  });

  it('should handle undefined currentCatBlock and set to 0', () => {
    mockTaskStoreData.currentCatBlock = undefined;
    moveToNextBlock();

    expect(mockTaskStoreData.currentCatBlock).toBe(0);
  });

  it('should set to customIndex when valid customIndex provided', () => {
    mockTaskStoreData.currentCatBlock = 0;
    moveToNextBlock(2);

    expect(mockTaskStoreData.currentCatBlock).toBe(2);
  });

  it('should throw error when customIndex not in catOrderMap', () => {
    expect(() => moveToNextBlock(99)).toThrow('Cannot set to block not in catOrderMap');
  });

  it('should allow setting to block 0 with customIndex', () => {
    mockTaskStoreData.currentCatBlock = 2;
    moveToNextBlock(0);

    expect(mockTaskStoreData.currentCatBlock).toBe(0);
  });

  it('should not increment when customIndex is 0', () => {
    mockTaskStoreData.currentCatBlock = 1;
    moveToNextBlock(0);

    expect(mockTaskStoreData.currentCatBlock).toBe(0);
  });

  it('should handle sequential block advancement', () => {
    mockTaskStoreData.currentCatBlock = 0;

    moveToNextBlock(); // 0 -> 1
    expect(mockTaskStoreData.currentCatBlock).toBe(1);

    moveToNextBlock(); // 1 -> 2
    expect(mockTaskStoreData.currentCatBlock).toBe(2);

    moveToNextBlock(); // 2 -> 3 (even though not in catOrderMap)
    expect(mockTaskStoreData.currentCatBlock).toBe(3);
  });

  it('should treat negative customIndex as no customIndex and increment', () => {
    mockTaskStoreData.currentCatBlock = 1;
    moveToNextBlock(-1);

    // Negative index is ignored, falls through to default increment behavior
    expect(mockTaskStoreData.currentCatBlock).toBe(2);
  });
});
