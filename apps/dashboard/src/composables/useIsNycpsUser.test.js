import { describe, it, expect } from 'vitest';
import { computed } from 'vue';
import useIsNycpsUser from './useIsNycpsUser';

describe('useIsNycpsUser', () => {
  it('should return true when user has nycps property set to true', () => {
    const userData = computed(() => ({ nycps: true }));
    const { isNycpsUser } = useIsNycpsUser(userData);

    expect(isNycpsUser.value).toBe(true);
  });

  it('should return false when user has nycps property set to false', () => {
    const userData = computed(() => ({ nycps: false }));
    const { isNycpsUser } = useIsNycpsUser(userData);

    expect(isNycpsUser.value).toBe(false);
  });

  it('should return false when user has no nycps property', () => {
    const userData = computed(() => ({ name: 'Test User' }));
    const { isNycpsUser } = useIsNycpsUser(userData);

    expect(isNycpsUser.value).toBe(false);
  });

  it('should return false when userData is null', () => {
    const userData = computed(() => null);
    const { isNycpsUser } = useIsNycpsUser(userData);

    expect(isNycpsUser.value).toBe(false);
  });

  it('should return false when userData is undefined', () => {
    const userData = computed(() => undefined);
    const { isNycpsUser } = useIsNycpsUser(userData);

    expect(isNycpsUser.value).toBe(false);
  });

  it('should return false when userData value is an empty object', () => {
    const userData = computed(() => ({}));
    const { isNycpsUser } = useIsNycpsUser(userData);

    expect(isNycpsUser.value).toBe(false);
  });

  it('should reactively update when userData changes', () => {
    const userData = computed(() => ({ nycps: false }));
    const { isNycpsUser } = useIsNycpsUser(userData);

    expect(isNycpsUser.value).toBe(false);

    // Simulate userData change
    const newUserData = computed(() => ({ nycps: true }));
    const { isNycpsUser: updatedIsNycpsUser } = useIsNycpsUser(newUserData);

    expect(updatedIsNycpsUser.value).toBe(true);
  });
});
