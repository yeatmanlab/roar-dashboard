import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useRoarApiError } from './useRoarApiError';

describe('useRoarApiError', () => {
  it('returns false/null when errorRef is null', () => {
    const errorRef = ref(null);
    const { isRosteringEnded, isTerminalAuth, errorCode, errorMessage } = useRoarApiError(errorRef);

    expect(isRosteringEnded.value).toBe(false);
    expect(isTerminalAuth.value).toBe(false);
    expect(errorCode.value).toBeNull();
    expect(errorMessage.value).toBeNull();
  });

  it('detects rostering-ended error', () => {
    const errorRef = ref({ body: { error: { code: 'auth/rostering-ended', message: 'Access ended' } } });
    const { isRosteringEnded, isTerminalAuth, errorCode, errorMessage } = useRoarApiError(errorRef);

    expect(isRosteringEnded.value).toBe(true);
    expect(isTerminalAuth.value).toBe(false);
    expect(errorCode.value).toBe('auth/rostering-ended');
    expect(errorMessage.value).toBe('Access ended');
  });

  it('detects terminal auth error (token-expired)', () => {
    const errorRef = ref({ body: { error: { code: 'auth/token-expired', message: 'Token expired' } } });
    const { isRosteringEnded, isTerminalAuth, errorCode } = useRoarApiError(errorRef);

    expect(isRosteringEnded.value).toBe(false);
    expect(isTerminalAuth.value).toBe(true);
    expect(errorCode.value).toBe('auth/token-expired');
  });

  it('detects terminal auth error (auth/required)', () => {
    const errorRef = ref({ body: { error: { code: 'auth/required', message: 'Login required' } } });
    const { isTerminalAuth } = useRoarApiError(errorRef);

    expect(isTerminalAuth.value).toBe(true);
  });

  it('reacts to ref changes', () => {
    const errorRef = ref(null);
    const { isRosteringEnded, errorCode } = useRoarApiError(errorRef);

    expect(isRosteringEnded.value).toBe(false);
    expect(errorCode.value).toBeNull();

    errorRef.value = { body: { error: { code: 'auth/rostering-ended', message: 'Ended' } } };

    expect(isRosteringEnded.value).toBe(true);
    expect(errorCode.value).toBe('auth/rostering-ended');
  });

  it('returns false for unrecognized error codes', () => {
    const errorRef = ref({ body: { error: { code: 'some/other-error', message: 'Unknown' } } });
    const { isRosteringEnded, isTerminalAuth } = useRoarApiError(errorRef);

    expect(isRosteringEnded.value).toBe(false);
    expect(isTerminalAuth.value).toBe(false);
  });
});
