import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import enComponentTranslations from '@/translations/en/en-componentTranslations.json';

const mockRefetch = vi.fn();
const claimsQueryState = {
  isLoading: ref(false),
  isFetching: ref(false),
  data: ref(null),
  error: ref(null),
};

const userTypeState = {
  userType: ref('student'),
  isAdmin: ref(false),
  isSuperAdmin: ref(false),
  isParticipant: ref(false),
  isLaunchAdmin: ref(false),
};

vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
  default: () => ({
    isLoading: claimsQueryState.isLoading,
    isFetching: claimsQueryState.isFetching,
    data: claimsQueryState.data,
    error: claimsQueryState.error,
    refetch: mockRefetch,
  }),
}));

vi.mock('@/composables/useUserType', () => ({
  default: () => ({
    userType: computed(() => userTypeState.userType.value),
    isAdmin: computed(() => userTypeState.isAdmin.value),
    isSuperAdmin: computed(() => userTypeState.isSuperAdmin.value),
    isParticipant: computed(() => userTypeState.isParticipant.value),
    isLaunchAdmin: computed(() => userTypeState.isLaunchAdmin.value),
  }),
}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({ logAuthEvent: vi.fn() }),
}));

// `isAuthReady` is true so `onMounted` calls `init()` and the component leaves
// its pre-initialization state without needing a store mutation.
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    ssoProvider: ref(null),
    isAuthReady: true,
    $subscribe: vi.fn(),
  }),
}));

vi.mock('@/store/game', () => ({
  useGameStore: () => ({ requireRefresh: ref(false) }),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store) => store,
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn(), go: vi.fn() }),
}));

const HomeSelector = (await import('./HomeSelector.vue')).default;

// The global `$t` mock in vitest.setup.js only resolves flat keys, so a real
// i18n instance is installed here to render the nested `homeSelector.*` keys.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enComponentTranslations },
});

/** Mount HomeSelector with the async home components stubbed out. */
function mountHomeSelector() {
  return mount(HomeSelector, {
    global: {
      plugins: [i18n],
      mocks: { $t: (key) => i18n.global.t(key) },
      stubs: {
        HomeParticipant: { template: '<div data-testid="home-participant" />' },
        HomeParent: { template: '<div data-testid="home-parent" />' },
        HomeAdministrator: { template: '<div data-testid="home-administrator" />' },
      },
    },
  });
}

describe('HomeSelector.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimsQueryState.isLoading.value = false;
    claimsQueryState.isFetching.value = false;
    claimsQueryState.data.value = null;
    claimsQueryState.error.value = null;
    userTypeState.isAdmin.value = false;
    userTypeState.isSuperAdmin.value = false;
    userTypeState.isParticipant.value = false;
    userTypeState.isLaunchAdmin.value = false;
  });

  it('shows the loading state while the claims query is in flight', async () => {
    claimsQueryState.isLoading.value = true;

    const wrapper = mountHomeSelector();
    await nextTick();

    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__error"]').exists()).toBe(false);
  });

  it('resolves loading to the error state when the claims query fails', async () => {
    // The regression this guards: `isLoading` keys off `!userClaims`, so a
    // settled failure (error set, data still null) used to spin forever.
    claimsQueryState.isLoading.value = false;
    claimsQueryState.error.value = new Error('/me request failed with status 500');

    const wrapper = mountHomeSelector();
    await nextTick();

    expect(wrapper.find('[data-testid="home-selector__error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(false);
    expect(wrapper.text()).toContain(enComponentTranslations.homeSelector.errorTitle);
  });

  it('shows the loading state, not the error, while a refetch of a failed query is in flight', async () => {
    // GenericError's Try Again invalidates `/me` before navigating here, so
    // the query arrives holding its old error while the refetch runs. The
    // error state must wait for the refetch to settle — otherwise the user
    // sees an error flash even when the retry succeeds.
    claimsQueryState.error.value = new Error('/me request failed with status 500');
    claimsQueryState.isFetching.value = true;

    const wrapper = mountHomeSelector();
    await nextTick();

    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__error"]').exists()).toBe(false);

    // The refetch settles without data: now the error state renders.
    claimsQueryState.isFetching.value = false;
    await nextTick();

    expect(wrapper.find('[data-testid="home-selector__error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(false);
  });

  it('refetches the claims query when the error state retry is clicked', async () => {
    claimsQueryState.error.value = new Error('boom');

    const wrapper = mountHomeSelector();
    await nextTick();

    await wrapper.find('[data-testid="home-selector__error"] button').trigger('click');

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders the participant home once claims resolve to a participant', async () => {
    claimsQueryState.data.value = { claims: {} };
    userTypeState.isParticipant.value = true;

    const wrapper = mountHomeSelector();
    await nextTick();

    expect(wrapper.find('[data-testid="home-participant"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="home-selector__unmatched"]').exists()).toBe(false);
  });

  it('renders the administrator home once claims resolve to an admin', async () => {
    claimsQueryState.data.value = { claims: {} };
    userTypeState.isAdmin.value = true;

    const wrapper = mountHomeSelector();
    await nextTick();

    expect(wrapper.find('[data-testid="home-administrator"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(false);
  });

  it('shows the unmatched state when claims resolve to no known user type', async () => {
    // Previously an empty `<div>` — a blank screen with no explanation.
    claimsQueryState.data.value = { claims: {} };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = mountHomeSelector();
    await nextTick();

    expect(wrapper.find('[data-testid="home-selector__unmatched"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="home-selector__error"]').exists()).toBe(false);

    // The on-screen copy is generic by design; the diagnostic detail must go to
    // console.error, which Sentry captures in production. This pins that contract.
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('no home view matched'), {
      userType: 'student',
    });
    consoleError.mockRestore();
  });

  it('renders the error branch ahead of the loading branch', async () => {
    // `isLoading` deliberately stays true on a settled failure — claims never
    // arrive, so `!userClaims` holds. The spinner is avoided only because the
    // template tests `hasError` first. Asserting both at once pins that order:
    // swap the v-if/v-else-if and this fails, where a render-only check passes.
    claimsQueryState.isLoading.value = false;
    claimsQueryState.data.value = null;
    claimsQueryState.error.value = new Error('/me request failed with status 500');

    const wrapper = mountHomeSelector();
    await nextTick();

    expect(wrapper.find('[data-testid="home-selector__error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(false);
    expect(wrapper.vm.isLoading).toBe(true);
  });

  it('never leaves loading unresolved: every settled state renders content or an error', async () => {
    // The acceptance criterion stated directly — for each settled combination
    // of (data, error), the loading branch must be gone.
    const settledCases = [
      { data: { claims: {} }, error: null, participant: true },
      { data: { claims: {} }, error: null, participant: false },
      { data: null, error: new Error('boom'), participant: false },
    ];

    for (const settled of settledCases) {
      claimsQueryState.isLoading.value = false;
      claimsQueryState.data.value = settled.data;
      claimsQueryState.error.value = settled.error;
      userTypeState.isParticipant.value = settled.participant;

      const wrapper = mountHomeSelector();
      await nextTick();

      expect(wrapper.find('[data-testid="home-selector__loading"]').exists()).toBe(false);

      const renderedSomething =
        wrapper.find('[data-testid="home-selector__error"]').exists() ||
        wrapper.find('[data-testid="home-selector__unmatched"]').exists() ||
        wrapper.find('[data-testid="home-participant"]').exists();
      expect(renderedSomething).toBe(true);
    }
  });
});
