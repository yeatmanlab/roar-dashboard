import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, toValue } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import TaskSRE from './TaskSRE.vue';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';

const mocks = vi.hoisted(() => ({
  useParticipantId: vi.fn(),
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

vi.mock('@/composables/useParticipantId', () => ({
  default: mocks.useParticipantId,
}));

vi.mock('@/composables/queries/useUserStudentDataQuery', () => ({
  default: mocks.useUserStudentDataQuery,
}));

vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getVariantById: mocks.getVariantById,
  initFirekitCompat: mocks.initFirekitCompat,
}));

vi.mock('@roar-platform/roar-sre', () => ({
  default: vi.fn().mockImplementation(() => ({ run: mocks.taskRun })),
}));

const PARENT_USER_ID = 'parent-user-uuid';
const CHILD_USER_ID = 'child-user-uuid';
const ADMINISTRATION_ID = 'backend-admin-uuid';
const VARIANT_ID = 'sre-variant-uuid';

/**
 * The administration the student homepage put in the game store, with `tasks`
 * embedded — this is where the component reads the variant from, keyed by the
 * catalog `taskSlug`.
 */
function seedSelectedAdmin(taskSlug = 'sre') {
  const gameStore = useGameStore();
  gameStore.selectedAdmin = {
    id: ADMINISTRATION_ID,
    tasks: [{ taskId: 'sre-task-uuid', taskSlug, variantId: VARIANT_ID }],
  };
}

// The component must resolve the same store instance the test seeds, so the
// active pinia and the one installed on the mount have to be identical.
let pinia;

function mountTask(props) {
  return mount(TaskSRE, {
    props,
    global: {
      plugins: [pinia],
      components: { AppSpinner: { template: '<div />' } },
    },
  });
}

describe('TaskSRE', () => {
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
    // Mirrors `useParticipantId`: the proxy id wins, otherwise the launching
    // user's own `/me` id. The resolution itself is covered by that composable's
    // own unit tests, so here it only has to supply the id the component consumes.
    mocks.useParticipantId.mockImplementation((launchId) => ref(launchId ?? PARENT_USER_ID));

    const authStore = useAuthStore();
    authStore.accessToken = 'test-token';
    authStore.firebaseUser = { uid: 'parent-firebase-uid' };
  });

  describe('proxy launch', () => {
    it('attributes the run to the child, not the launching user', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'sre', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // The whole point of the proxy path: `launchId` is the participant, so the
      // parent's own `/me` id must not reach the SDK or the run it creates.
      expect(initFirekitCompat).toHaveBeenCalledWith(
        expect.objectContaining({ participant: { participantId: CHILD_USER_ID } }),
        expect.objectContaining({ administrationId: ADMINISTRATION_ID, isAnonymous: false, variantId: VARIANT_ID }),
      );
      expect(initFirekitCompat).not.toHaveBeenCalledWith(
        expect.objectContaining({ participant: { participantId: PARENT_USER_ID } }),
        expect.anything(),
      );

      // The component's side of the contract: hand the launch prop to the
      // composable and use what it returns, rather than resolving identity itself.
      expect(mocks.useParticipantId).toHaveBeenCalledWith(CHILD_USER_ID);

      wrapper.unmount();
    });

    it('loads the child profile so task params use the child grade and DOB', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'sre', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();

      // Regression guard: this query used to be disabled whenever `launchId` was
      // set, so a proxy launch ran with no grade and no DOB.
      //
      // The id is passed as a ref rather than a static value, so the query re-keys
      // if identity resolves after setup instead of capturing `undefined`.
      const [passedId, queryOptions] = mocks.useUserStudentDataQuery.mock.calls[0];
      expect(toValue(passedId)).toBe(CHILD_USER_ID);
      expect(queryOptions.enabled.value).toBe(true);

      wrapper.unmount();
    });

    it('resolves the variant from the selected administration', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'sre', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      expect(getVariantById).toHaveBeenCalledWith(VARIANT_ID);

      wrapper.unmount();
    });
  });

  describe('self launch', () => {
    it('attributes the run to the launching user when no launchId is given', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'sre', language: 'en' });
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

      const wrapper = mountTask({ taskId: 'sre', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // A missing variant must not start a run against the wrong assessment.
      expect(initFirekitCompat).not.toHaveBeenCalled();
      expect(globalThis.alert).toHaveBeenCalled();

      wrapper.unmount();
    });
  });
});
