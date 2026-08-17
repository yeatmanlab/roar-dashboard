import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import TaskSRE from './TaskSRE.vue';
import { getRoarApiClient } from '@/clients/roar-api';
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
  useRouter: () => ({
    go: mocks.routerGo,
    push: mocks.routerPush,
  }),
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

vi.mock('@roar-platform/roar-sre', () => ({
  default: vi.fn().mockImplementation(() => ({
    run: mocks.taskRun,
  })),
}));

describe('TaskSRE', () => {
  let pinia;

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
  });

  it('uses launchId as the participant for proxy launch calls', async () => {
    const parentUserId = 'parent-user-uuid';
    const childUserId = 'child-user-uuid';
    const taskUuid = 'sre-task-uuid';
    const administrationId = 'backend-admin-uuid';
    const variantId = 'sre-variant-uuid';
    const listUserAdministrations = vi.fn().mockResolvedValue({
      status: 200,
      body: {
        data: {
          items: [
            {
              id: administrationId,
              tasks: [{ taskId: taskUuid, variantId }],
            },
          ],
        },
      },
    });
    const roarApiClient = {
      tasks: { get: vi.fn().mockResolvedValue({ status: 200, body: { data: { id: taskUuid } } }) },
      me: { get: vi.fn().mockResolvedValue({ status: 200, body: { data: { id: parentUserId } } }) },
      users: { listUserAdministrations },
    };
    mocks.getRoarApiClient.mockReturnValue(roarApiClient);

    const authStore = useAuthStore();
    authStore.accessToken = 'test-token';
    authStore.firebaseUser = { uid: 'parent-firebase-uid' };

    const gameStore = useGameStore();
    gameStore.selectedAdmin = { id: 'legacy-firestore-admin-id' };

    const wrapper = mount(TaskSRE, {
      props: { taskId: 'sre', language: 'en', launchId: childUserId },
      global: {
        plugins: [pinia],
        components: {
          AppSpinner: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    expect(getRoarApiClient).toHaveBeenCalledTimes(1);
    expect(mocks.useUserStudentDataQuery).toHaveBeenCalledWith(
      childUserId,
      expect.objectContaining({ enabled: expect.any(Object) }),
    );
    expect(mocks.useUserStudentDataQuery.mock.calls[0][1].enabled.value).toBe(true);
    expect(roarApiClient.me.get).toHaveBeenCalledTimes(1);
    expect(listUserAdministrations).toHaveBeenCalledWith({
      params: { userId: childUserId },
      query: { embed: 'tasks', perPage: 50 },
    });
    expect(listUserAdministrations).not.toHaveBeenCalledWith(
      expect.objectContaining({ params: { userId: parentUserId } }),
    );
    expect(initFirekitCompat).toHaveBeenCalledWith(
      expect.objectContaining({
        participant: { participantId: childUserId },
      }),
      expect.objectContaining({
        administrationId,
        isAnonymous: false,
        variantId,
      }),
    );
    expect(getVariantById).toHaveBeenCalledWith(variantId);

    wrapper.unmount();
  });
});
