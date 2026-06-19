import { nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { useTasksVariantsToggleRegistered } from './useTasksVariantsToggleRegistered';

const mockRefetch = vi.fn();

vi.mock('@/composables/queries/useTaskVariantsQuery', () => ({
  default: () => ({ refetch: mockRefetch }),
}));

describe('useTasksVariantsToggleRegistered', () => {
  beforeEach(() => {
    localStorage.clear();
    mockRefetch.mockReset();
  });

  it('removes the stale registeredTasksOnly key on initialization', () => {
    localStorage.setItem('registeredTasksOnly', 'true');

    withSetup(() => useTasksVariantsToggleRegistered());

    expect(localStorage.getItem('registeredTasksOnly')).toBeNull();
  });

  it('defaults registeredVariantsOnly to true when no value is persisted', () => {
    const [result] = withSetup(() => useTasksVariantsToggleRegistered());

    expect(result.registeredVariantsOnly.value).toBe(true);
  });

  it('initializes registeredVariantsOnly from the persisted value', () => {
    localStorage.setItem('registeredVariantsOnly', 'false');

    const [result] = withSetup(() => useTasksVariantsToggleRegistered());

    expect(result.registeredVariantsOnly.value).toBe(false);
  });

  it('updates the ref, persists the value, and refetches on toggle', async () => {
    const [result] = withSetup(() => useTasksVariantsToggleRegistered());

    result.updateRegisteredVariantsOnly(false);
    await nextTick();

    expect(result.registeredVariantsOnly.value).toBe(false);
    expect(localStorage.getItem('registeredVariantsOnly')).toBe('false');
    expect(mockRefetch).toHaveBeenCalled();
  });
});
