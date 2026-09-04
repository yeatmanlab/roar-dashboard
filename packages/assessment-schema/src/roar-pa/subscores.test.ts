import { describe, it, expect } from 'vitest';
import { PA_SUBTASK_KEYS, PA_SUBSCORE_DEFS } from './index.js';

describe('PA_SUBSCORE_DEFS', () => {
  it('covers every key in PA_SUBTASK_KEYS', () => {
    for (const key of PA_SUBTASK_KEYS) {
      expect(PA_SUBSCORE_DEFS).toHaveProperty(key);
    }
  });
});
