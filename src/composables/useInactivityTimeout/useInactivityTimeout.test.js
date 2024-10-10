import { nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup';
import useInactivityTimeout from './useInactivityTimeout';
import { ref } from 'vue';

const idle = ref(false);
const lastActive = ref(Date.now());

vi.mock('@vueuse/core', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    useIdle: vi.fn(() => {
      return {
        idle,
        lastActive,
      };
    }),
    useTimestamp: vi.fn(() => ref(Date.now())),
  };
});

describe('useInactivityTimeout', () => {
  let idleThreshold, countdownDuration, onIdle, onTimeout;

  beforeEach(() => {
    vi.useFakeTimers({});
    idleThreshold = 5000;
    countdownDuration = 10000;
    onIdle = vi.fn();
    onTimeout = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    idle.value = false;
  });

  it('should initialize with correct countdown timer value', () => {
    const [result] = withSetup(() =>
      useInactivityTimeout({
        idleThreshold,
        countdownDuration: 15000,
        onIdle,
        onTimeout,
      }),
    );

    expect(result.countdownTimer.value).toBe(15);
  });

  it('should invoke the onIdle callback and start countdown when user goes idle', async () => {
    const [result] = withSetup(() =>
      useInactivityTimeout({
        idleThreshold,
        countdownDuration,
        onIdle,
        onTimeout,
      }),
    );

    idle.value = true;
    await nextTick();

    vi.advanceTimersByTime(idleThreshold + 1000);
    await nextTick();

    expect(onIdle).toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();

    expect(result.countdownTimer.value).toBeLessThan(10);
  });

  it('should invoke the onTimeout callback when countdown reaches zero', async () => {
    withSetup(() =>
      useInactivityTimeout({
        idleThreshold,
        countdownDuration,
        onIdle,
        onTimeout,
      }),
    );

    idle.value = true;
    await nextTick();

    vi.advanceTimersByTime(idleThreshold + countdownDuration + 1000);
    await nextTick();

    expect(onIdle).toHaveBeenCalled();
    expect(onTimeout).toHaveBeenCalled();
  });

  it('should reset the countdown when the user becomes active again', async () => {
    const [result] = withSetup(() =>
      useInactivityTimeout({
        idleThreshold,
        countdownDuration,
        onIdle,
        onTimeout,
      }),
    );

    idle.value = true;
    await nextTick();

    vi.advanceTimersByTime(2000);
    await nextTick();

    expect(result.countdownTimer.value).toBe(8);

    idle.value = false;
    await nextTick();

    vi.runAllTimers();
    await nextTick();

    expect(result.countdownTimer.value).toBe(10);
  });

  it('should handle visibility change correctly', async () => {
    const [result] = withSetup(() =>
      useInactivityTimeout({
        idleThreshold,
        countdownDuration,
        onIdle,
        onTimeout,
      }),
    );

    idle.value = false;
    lastActive.value = Date.now();
    await nextTick();

    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(result.countdownTimer.value).toBe(10);

    vi.advanceTimersByTime(idleThreshold + 3000);
    await nextTick();

    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(result.countdownTimer.value).toBe(7);
  });

  it('should invoke the onTimeout callback after extended idle time outside the page', async () => {
    const [result] = withSetup(() =>
      useInactivityTimeout({
        idleThreshold,
        countdownDuration,
        onIdle,
        onTimeout,
      }),
    );

    idle.value = true;
    await nextTick();

    vi.advanceTimersByTime(idleThreshold + 1000);
    await nextTick();

    expect(onIdle).toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();

    expect(result.countdownTimer.value).toBe(4);

    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    vi.advanceTimersByTime(20000);
    await nextTick();

    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onTimeout).toHaveBeenCalled();
  });

  it('should reset timer on unmount', async () => {
    const [result, app] = withSetup(() =>
      useInactivityTimeout({
        idleThreshold,
        countdownDuration: 15000,
        onIdle,
        onTimeout,
      }),
    );

    app.unmount();
    expect(result.countdownTimer.value).toBe(15);
  });
});
