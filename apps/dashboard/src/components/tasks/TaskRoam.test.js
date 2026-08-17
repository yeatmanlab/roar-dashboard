import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import TaskRoam from './TaskRoam.vue';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';

const mocks = vi.hoisted(() => ({
  getRoarApiClient: vi.fn(),
  getVariantById: vi.fn(),
  initFirekitCompat: vi.fn(),
  routerGo: vi.fn(),
  routerPush: vi.fn(),
  taskRun: vi.fn(),
  useUserStudentDataQuery: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ go: mocks.routerGo, push: mocks.routerPush }),
}));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: mocks.getRoarApiClient,
}));

vi.mock('@/composables/queries/useUserStudentDataQuery', () => ({
  default: mocks.useUserStudentDataQuery,
}));

vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getVariantById: mocks.getVariantById,
  initFirekitCompat: mocks.initFirekitCompat,
}));

// ROAM exposes the launcher as a named `TaskLauncher` export, not a default.
vi.mock('@roar-platform/roam-apps', () => ({
  TaskLauncher: vi.fn().mockImplementation(() => ({ run: mocks.taskRun })),
}));

const PARENT_USER_ID = 'parent-user-uuid';
const CHILD_USER_ID = 'child-user-uuid';
const ADMINISTRATION_ID = 'backend-admin-uuid';
const VARIANT_ID = 'roam-variant-uuid';

// The component must resolve the same store instance the test seeds, so the
// active pinia and the one installed on the mount have to be identical.
let pinia;

function seedSelectedAdmin(taskSlug = 'fluency-arf') {
  const gameStore = useGameStore();
  gameStore.selectedAdmin = {
    id: ADMINISTRATION_ID,
    tasks: [{ taskId: 'roam-task-uuid', taskSlug, variantId: VARIANT_ID }],
  };
}

function mountTask(props) {
  return mount(TaskRoam, {
    props,
    global: {
      plugins: [pinia],
      components: { AppSpinner: { template: '<div />' } },
    },
  });
}

describe('TaskRoam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    globalThis.alert = vi.fn();

    mocks.useUserStudentDataQuery.mockReturnValue({
      isLoading: ref(false),
      data: ref({ studentData: { dob: '2015-04-01', grade: '5' } }),
    });
    mocks.getVariantById.mockResolvedValue({ variantParams: { someParam: true } });
    mocks.taskRun.mockResolvedValue(undefined);
    mocks.getRoarApiClient.mockReturnValue({
      me: { get: vi.fn().mockResolvedValue({ status: 200, body: { data: { id: PARENT_USER_ID } } }) },
    });

    const authStore = useAuthStore();
    authStore.accessToken = 'test-token';
    authStore.firebaseUser = { uid: 'parent-firebase-uid' };
  });

  describe('proxy launch', () => {
    it('starts the task instead of rejecting the proxy path', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'fluency-arf', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // ROAM used to throw "Proxy-launch path is not yet supported" here, which
      // dead-ended every /launch/:launchId ROAM route in the generic error alert.
      expect(globalThis.alert).not.toHaveBeenCalled();
      expect(initFirekitCompat).toHaveBeenCalled();
      expect(mocks.taskRun).toHaveBeenCalled();

      wrapper.unmount();
    });

    it('attributes the run to the child, not the launching user', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'fluency-arf', launchId: CHILD_USER_ID });
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

    it('loads the child profile so task params use the child grade and DOB', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'fluency-arf', launchId: CHILD_USER_ID });
      await flushPromises();

      // Regression guard: this query used to be disabled whenever `launchId` was
      // set, so a proxy launch ran with no grade and no DOB.
      expect(mocks.useUserStudentDataQuery).toHaveBeenCalledWith(
        CHILD_USER_ID,
        expect.objectContaining({ enabled: expect.any(Object) }),
      );
      expect(mocks.useUserStudentDataQuery.mock.calls[0][1].enabled.value).toBe(true);

      wrapper.unmount();
    });

    it('resolves the variant from the selected administration', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'fluency-arf', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      expect(getVariantById).toHaveBeenCalledWith(VARIANT_ID);

      wrapper.unmount();
    });

    it('matches the variant by the language-suffixed slug the router passes', async () => {
      seedSelectedAdmin('fluency-arf-es');

      const wrapper = mountTask({ taskId: 'fluency-arf-es', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // ROAM is language-as-task: each language is its own slug, so the wrong
      // language variant must not be selected for a given route.
      expect(getVariantById).toHaveBeenCalledWith(VARIANT_ID);

      wrapper.unmount();
    });
  });

  describe('self launch', () => {
    it('attributes the run to the launching user when no launchId is given', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'fluency-arf' });
      await flushPromises();
      await flushPromises();

      expect(initFirekitCompat).toHaveBeenCalledWith(
        expect.objectContaining({ participant: { participantId: PARENT_USER_ID } }),
        expect.anything(),
      );

      wrapper.unmount();
    });
  });

  describe('when the task is not in the selected administration', () => {
    it('does not initialize the SDK', async () => {
      seedSelectedAdmin('some-other-task');

      const wrapper = mountTask({ taskId: 'fluency-arf', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      expect(initFirekitCompat).not.toHaveBeenCalled();
      expect(globalThis.alert).toHaveBeenCalled();

      wrapper.unmount();
    });
  });
});
