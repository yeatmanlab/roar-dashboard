import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records the order of the two operations whose sequencing is the whole point:
// the AuthService must be created BEFORE the app (and thus the router) mounts,
// so the first navigation's readiness gate has a service to await.
const order = [];

const mockCreateAuthService = vi.fn(() => order.push('createAuthService'));
const mockMount = vi.fn(() => order.push('mount'));
const mockUse = vi.fn();

vi.mock('vue', () => ({
  createApp: vi.fn(() => ({ use: mockUse, mount: mockMount, component: vi.fn(), directive: vi.fn() })),
}));

// The plugin list and global registrations are not under test; stub the heavy
// imports so `createAppInstance` runs without pulling the real app graph.
vi.mock('vue-recaptcha', () => ({ VueRecaptchaPlugin: {} }));
vi.mock('@/sentry', () => ({ initSentry: vi.fn() }));
vi.mock('primevue/tooltip', () => ({ default: {} }));
vi.mock('@/App.vue', () => ({ default: {} }));
vi.mock('@/components/AppSpinner.vue', () => ({ default: {} }));
vi.mock('./plugins', () => ({ default: [] }));
vi.mock('./styles.css', () => ({}));
vi.mock('@/services/AuthService', () => ({ createAuthService: mockCreateAuthService }));

describe('mountApp bootstrap ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
  });

  it('creates the AuthService before mounting the app', async () => {
    const { mountApp } = await import('./setup');
    mountApp();

    // The gate's precondition: a service exists before the router (installed at
    // mount) runs its first navigation.
    expect(order).toEqual(['createAuthService', 'mount']);
  });

  it('passes the Firebase config to createAuthService', async () => {
    const { mountApp } = await import('./setup');
    mountApp();

    expect(mockCreateAuthService).toHaveBeenCalledTimes(1);
    // The config is assembled from import.meta.env (undefined under vitest);
    // assert the keys the AuthService reads are present rather than their values.
    const config = mockCreateAuthService.mock.calls[0][0];
    expect(Object.keys(config)).toEqual(
      expect.arrayContaining(['projectId', 'apiKey', 'authDomain', 'emulatorAuthHost']),
    );
  });
});
