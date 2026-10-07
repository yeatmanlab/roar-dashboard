import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import TaskSurvey from './TaskSurvey.vue';

// TaskSurvey is spelled out rather than using `describeTaskProxyLaunch`: it has no
// student-data query (surveys take no grade/DOB) and no class-based launcher — it
// renders SurveyRunner and hands it the SDK context as props.
//
// Since #2016 the component neither initializes the SDK nor fetches survey content:
// SurveyRunner owns both. What is asserted here is the participant contract — right
// participant, right variant, right administration, right language — observed on the
// props handed over rather than on SDK calls.
const mocks = vi.hoisted(() => ({
  useParticipantId: vi.fn(),
  routerGo: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ go: mocks.routerGo, push: mocks.routerPush }),
}));

vi.mock('@/composables/useParticipantId', () => ({
  default: mocks.useParticipantId,
}));

// Declares its props so the handed-over context is readable via `.props()`.
vi.mock('@roar-platform/roar-survey', () => ({
  default: {
    name: 'SurveyRunner',
    props: ['sdkContext', 'language'],
    template: '<div />',
  },
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

/** The props TaskSurvey handed to SurveyRunner, or undefined if it never rendered. */
function surveyProps(wrapper) {
  const runner = wrapper.findComponent({ name: 'SurveyRunner' });
  return runner.exists() ? runner.props() : undefined;
}

describe('TaskSurvey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    globalThis.alert = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mirrors `useParticipantId`: the proxy id wins, otherwise the launching
    // user's own `/me` id. The resolution itself is covered by that composable's
    // own unit tests, so here it only has to supply the id the component consumes.
    mocks.useParticipantId.mockImplementation((launchId) => ref(launchId ?? PARENT_USER_ID));

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
      expect(surveyProps(wrapper)).toBeDefined();

      wrapper.unmount();
    });

    it('attributes the run to the child, not the launching user', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      const { sdkContext } = surveyProps(wrapper);
      expect(sdkContext.ctx).toEqual(expect.objectContaining({ participant: { participantId: CHILD_USER_ID } }));
      expect(sdkContext.taskInfo).toEqual(
        expect.objectContaining({ administrationId: ADMINISTRATION_ID, isAnonymous: false, variantId: VARIANT_ID }),
      );

      // The component's side of the contract: hand the launch prop to the
      // composable and use what it returns, rather than resolving identity itself.
      expect(mocks.useParticipantId).toHaveBeenCalledWith(CHILD_USER_ID);

      wrapper.unmount();
    });

    it("hands the administration's variant to the survey", async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // The dashboard identifies the variant; SurveyRunner resolves its parameters and
      // fetches the named content file.
      expect(surveyProps(wrapper).sdkContext.taskInfo).toEqual(expect.objectContaining({ variantId: VARIANT_ID }));

      wrapper.unmount();
    });

    it('passes the route language through to the survey', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'es', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // The language decides which locale directory the content is read from, so it has
      // to reach SurveyRunner or the child gets the wrong survey.
      expect(surveyProps(wrapper).language).toBe('es');

      wrapper.unmount();
    });
  });

  describe('self launch', () => {
    it('attributes the run to the launching user when no launchId is given', async () => {
      seedSelectedAdmin();

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en' });
      await flushPromises();
      await flushPromises();

      expect(surveyProps(wrapper).sdkContext.ctx).toEqual(
        expect.objectContaining({ participant: { participantId: PARENT_USER_ID } }),
      );

      wrapper.unmount();
    });
  });

  describe('when the survey is not in the selected administration', () => {
    it('does not hand a context to the survey', async () => {
      seedSelectedAdmin('some-other-task');

      const wrapper = mountTask({ taskId: 'roar-survey', language: 'en', launchId: CHILD_USER_ID });
      await flushPromises();
      await flushPromises();

      // A missing variant must not start a run against the wrong assessment.
      expect(surveyProps(wrapper)).toBeUndefined();
      expect(globalThis.alert).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();

      wrapper.unmount();
    });
  });
});
