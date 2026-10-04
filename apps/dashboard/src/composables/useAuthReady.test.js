import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthReady } from './useAuthReady';

// A ref-free fake auth store: `isAuthReady` is a plain getter over the mutable
// `accessToken`, and `$subscribe` captures the callback so tests can drive
// store mutations by hand (the real Pinia subscribe fires on every mutation).
const subscribers = [];
const fakeStore = {
  accessToken: null,
  get isAuthReady() {
    return Boolean(this.accessToken);
  },
  $subscribe(cb) {
    subscribers.push(cb);
    return () => {
      const i = subscribers.indexOf(cb);
      if (i !== -1) subscribers.splice(i, 1);
    };
  },
};

/** Emit a store mutation to every live subscriber, mirroring Pinia. */
const emitMutation = () => {
  for (const cb of [...subscribers]) cb({ type: 'direct' }, fakeStore);
};

vi.mock('@/store/auth', () => ({
  useAuthStore: () => fakeStore,
}));

describe('useAuthReady', () => {
  beforeEach(() => {
    subscribers.length = 0;
    fakeStore.accessToken = null;
  });

  it('starts not ready when no token is present', () => {
    const [{ ready }] = withSetup(() => useAuthReady());
    expect(ready.value).toBe(false);
  });

  it('is ready at mount when a token is already present', () => {
    // A reload with a restored session: the token is set before the component
    // mounts, so the onMounted fallback must catch it (the subscribe only sees
    // future mutations).
    fakeStore.accessToken = 'token-abc';
    const [{ ready }] = withSetup(() => useAuthReady());
    expect(ready.value).toBe(true);
  });

  it('becomes ready when the token arrives after mount', () => {
    const [{ ready }] = withSetup(() => useAuthReady());
    expect(ready.value).toBe(false);

    fakeStore.accessToken = 'token-abc';
    emitMutation();

    expect(ready.value).toBe(true);
  });

  it('unsubscribes once ready — later mutations do not re-run the gate', () => {
    withSetup(() => useAuthReady());

    fakeStore.accessToken = 'token-abc';
    emitMutation();
    // One subscriber attached, and it removed itself on first readiness.
    expect(subscribers.length).toBe(0);
  });

  it('stays ready and ignores mutations fired after it opened', () => {
    const [{ ready }] = withSetup(() => useAuthReady());
    fakeStore.accessToken = 'token-abc';
    emitMutation();

    fakeStore.accessToken = null;
    emitMutation();

    // Readiness is monotonic; a later sign-out does not reopen the gate here.
    expect(ready.value).toBe(true);
  });

  it('ignores a mutation that does not carry a token', () => {
    const [{ ready }] = withSetup(() => useAuthReady());
    emitMutation();
    expect(ready.value).toBe(false);
    // Still subscribed — the gate never opened.
    expect(subscribers.length).toBe(1);
  });

  it('tears the subscription down on unmount if it never became ready', () => {
    const [, app] = withSetup(() => useAuthReady());
    expect(subscribers.length).toBe(1);

    app.unmount();

    expect(subscribers.length).toBe(0);
  });

  it('exposes a readonly ref', () => {
    const [{ ready }] = withSetup(() => useAuthReady());
    ready.value = true;
    // readonly() blocks the write (Vue warns); the gate must only open through
    // the store signal.
    expect(ready.value).toBe(false);
  });
});
