import { describe, it, expect } from 'vitest';
import { useCapsLock } from './useCapsLock';

describe('useCapsLock', () => {
  it('should initialize with capsLockEnabled as false', () => {
    const { capsLockEnabled } = useCapsLock();

    expect(capsLockEnabled.value).toBe(false);
  });

  it('should detect caps lock enabled', () => {
    const { capsLockEnabled, checkForCapsLock } = useCapsLock();

    const mockEvent = {
      getModifierState: (key) => key === 'CapsLock',
    };

    checkForCapsLock(mockEvent);

    expect(capsLockEnabled.value).toBe(true);
  });

  it('should detect caps lock disabled', () => {
    const { capsLockEnabled, checkForCapsLock } = useCapsLock();

    const mockEvent = {
      getModifierState: (key) => key !== 'CapsLock',
    };

    checkForCapsLock(mockEvent);

    expect(capsLockEnabled.value).toBe(false);
  });

  it('should handle event without getModifierState', () => {
    const { capsLockEnabled, checkForCapsLock } = useCapsLock();

    const mockEvent = {};

    expect(() => {
      checkForCapsLock(mockEvent);
    }).not.toThrow();

    expect(capsLockEnabled.value).toBe(false);
  });

  it('should handle null event', () => {
    const { capsLockEnabled, checkForCapsLock } = useCapsLock();

    expect(() => {
      checkForCapsLock(null);
    }).not.toThrow();

    expect(capsLockEnabled.value).toBe(false);
  });

  it('should handle undefined event', () => {
    const { capsLockEnabled, checkForCapsLock } = useCapsLock();

    expect(() => {
      checkForCapsLock(undefined);
    }).not.toThrow();

    expect(capsLockEnabled.value).toBe(false);
  });
});
