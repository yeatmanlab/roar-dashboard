import { describe, it, expect } from 'vitest';
import { useGlobalError } from './useGlobalError';

describe('useGlobalError', () => {
  it('starts with null global error', () => {
    const { globalError, clearGlobalError } = useGlobalError();
    // Ensure clean state for this test
    clearGlobalError();
    expect(globalError.value).toBeNull();
  });

  it('sets and reads a global error', () => {
    const { globalError, setGlobalError, clearGlobalError } = useGlobalError();
    setGlobalError({ type: 'rostering-ended' });
    expect(globalError.value).toEqual({ type: 'rostering-ended' });
    clearGlobalError();
  });

  it('sets error with optional message', () => {
    const { globalError, setGlobalError, clearGlobalError } = useGlobalError();
    setGlobalError({ type: 'server-error', message: 'Something broke' });
    expect(globalError.value).toEqual({ type: 'server-error', message: 'Something broke' });
    clearGlobalError();
  });

  it('clears the global error', () => {
    const { globalError, setGlobalError, clearGlobalError } = useGlobalError();
    setGlobalError({ type: 'auth-expired' });
    expect(globalError.value).not.toBeNull();
    clearGlobalError();
    expect(globalError.value).toBeNull();
  });

  it('shares state across multiple calls (module-scoped singleton)', () => {
    const instance1 = useGlobalError();
    const instance2 = useGlobalError();

    instance1.setGlobalError({ type: 'server-error' });
    expect(instance2.globalError.value).toEqual({ type: 'server-error' });
    instance1.clearGlobalError();
  });
});
