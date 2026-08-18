import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import TaskSurvey from './TaskSurvey.vue';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';

// TaskSurvey is spelled out rather than using `describeTaskProxyLaunch`: it has no
// student-data query (surveys take no grade/DOB), no task launcher, and it fetches
// its questions from GCS — so it shares the participant contract but not the shape
// the shared suite asserts.
const mocks = vi.hoisted(() => ({
  getRoarApiClient: vi.fn(),
  getVariantById: vi.fn(),
  initFirekitCompat: vi.fn(),
  routerGo: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ go: mocks.routerGo, push: mocks.routerPush }),
}));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: mocks.getRoarApiClient,
}));

vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getVariantById: mocks.getVariantById,
  initFirekitCompat: mocks.initFirekitCompat,
}));

vi.mock('@roar-platform/roar-survey', () => ({
  default: { template: '<div />' },
}));

const PARENT_USER_ID = 'parent-user-uuid';
const CHILD_USER_ID = 'child-user-uuid';
const ADMINISTRATION_ID = 'backend-admin-uuid';
const VARIANT_ID = 'survey-variant-uuid';

// The component must resolve the same store instance the test seeds, so the
// active pinia and the one installed on the mount have to be identical.
let pinia;

function seedSelectedAdmin(taskSlug = 'roar-survey') {
  const gameStore = useGameStore();
  gameStore.selectedAdmin = {
    id: ADMINISTRATION_ID,
    tasks: [{ taskId: 'survey-task-uuid', taskSlug, variantId: VARIANT_ID }],
  };
}

function mountTask(props) {
  return mount(TaskSurvey, {
    props,
    global: {
      plugins: [pinia],
      components: { AppSpinner: { template: '<div />' } },
    },
  });
}

describe('TaskSurvey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    globalThis.alert = vi.fn();

    // Survey has no student-data query; it pulls its questions from GCS instead,
    // using the `survey` key the seeded variant carries.
    mocks.getVariantById.mockResolvedValue({ variantParams: { survey: 'survey-file' } });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ pages: [] }) });
    mocks.getRoarApiClient.mockReturnValue({
      me: { get: vi.fn().mockResolvedValue({ status: 200, body: { data: { id: PARENT_USER_ID } } }) },
    });

    const authStore = useAuthStore();
    authStore.accessToken = 'test-token';
    authStore.firebaseUser = { uid: 'parent-firebase-uid' };
  });

  describe('proxy launch', () => {
    it('starts the survey instead of rejecting the proxy path', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // Survey used to throw before doing any work at all — its guard sat at the
      // very top of startTask, so the proxy path never reached the SDK.
      expect(globalThis.alert).not.toHaveBeenCalled();
      expect(initFirekitCompat).toHaveBeenCalled();

      wrapper.unmount();
    });

    it('attributes the run to the child, not the launching user', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      expect(initFirekitCompat).toHaveBeenCalledWith(
        expect.objectContaining({ participant: { participantId: CHILD_USER_ID } }),
        expect.objectContaining({ administrationId: ADMINISTRATION_ID, isAnonymous: false, variantId: VARIANT_ID }),
      );
      expect(initFirekitCompat).not.toHaveBeenCalledWith(
        expect.objectContaining({ participant: { participantId: PARENT_USER_ID } }),
        expect.anything(),
      );

      wrapper.unmount();
    });

    it('resolves the variant from the selected administration', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      expect(getVariantById).toHaveBeenCalledWith(VARIANT_ID);

      wrapper.unmount();
    });

    it('fetches the survey for the requested language', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'es', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // The filename comes from the variant, the language from the route prop —
      // both have to reach the bucket URL or the child gets the wrong survey.
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://storage.googleapis.com/roar-survey-app/es/survey-file.json',
      );

      wrapper.unmount();
    });
  });

  describe('self launch', () => {
    it('attributes the run to the launching user when no launchId is given', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en' });
      await flushPromises();
      await flushPromises();

      expect(initFirekitCompat).toHaveBeenCalledWith(
        expect.objectContaining({ participant: { participantId: PARENT_USER_ID } }),
        expect.anything(),
      );

      wrapper.unmount();
    });
  });

  describe('when the survey is not in the selected administration', () => {
    it('does not initialize the SDK', async () => {
      seedSelectedAdmin('some-other-task');

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      expect(initFirekitCompat).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(globalThis.alert).toHaveBeenCalled();

      wrapper.unmount();
    });
  });
});
