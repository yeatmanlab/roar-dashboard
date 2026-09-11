import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, toValue } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useParticipantId from '@/composables/useParticipantId';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';

export const PARENT_USER_ID = 'parent-user-uuid';
export const CHILD_USER_ID = 'child-user-uuid';
export const ADMINISTRATION_ID = 'backend-admin-uuid';
export const VARIANT_ID = 'task-variant-uuid';

/**
 * Shared proxy-launch contract for the SDK task components.
 *
 * Every task component resolves the participant the same way — `props.launchId`
 * when a parent launches a child, otherwise the launching user's own `/me` id —
 * and every one of them must attribute the run to that participant, load that
 * participant's profile, and read the variant from the administration the
 * homepage put in the game store. Those are asserted once here rather than
 * copied into eleven near-identical spec files; each spec supplies only its own
 * module mocks (which `vi.mock` requires to be file-local) and the bindings below.
 *
 * The mocked modules are imported directly rather than passed in: `vi.mock` in
 * the calling spec replaces them for that spec's whole module graph, so the
 * spies this helper sees are the same ones the component calls.
 *
 * @param {Object} options
 * @param {String} options.name – Component name, used for the describe block.
 * @param {Object} options.component – The task component under test.
 * @param {String} options.taskSlug – Catalog slug the router passes as `taskId`;
 *   the component matches it against the administration's embedded `taskSlug`.
 * @param {Object} [options.props] – Extra props the route supplies (e.g. `language`).
 */
export function describeTaskProxyLaunch({ name, component, taskSlug, props = {} }) {
  describe(`${name} proxy-launch contract`, () => {
    // The component must resolve the same store instances the test seeds, so the
    // active pinia and the one installed on the mount have to be identical.
    let pinia;

    function seedSelectedAdmin(slug = taskSlug) {
      const gameStore = useGameStore();
      gameStore.selectedAdmin = {
        id: ADMINISTRATION_ID,
        tasks: [{ taskId: 'backend-task-uuid', taskSlug: slug, variantId: VARIANT_ID }],
      };
    }

    function mountTask(overrides = {}) {
      return mount(component, {
        props: { taskId: taskSlug, ...props, ...overrides },
        global: {
          plugins: [pinia],
          components: { AppSpinner: { template: '<div />' } },
        },
      });
    }

    beforeEach(() => {
      vi.clearAllMocks();
      pinia = createPinia();
      setActivePinia(pinia);
      globalThis.alert = vi.fn();
      // The components log through `console.error` before alerting. Stubbed so the
      // expected failure path stays out of CI output, and asserted where it matters.
      vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(useUserStudentDataQuery).mockReturnValue({
        isLoading: ref(false),
        data: ref({ studentData: { dob: '2015-04-01', grade: '5' } }),
      });
      vi.mocked(getVariantById).mockResolvedValue({ variantParams: { someParam: true } });
      // Mirrors `useParticipantId`: the selected child wins, otherwise the launching
      // user's own `/me` id. That resolution has its own unit tests, so here the mock
      // only has to supply the id the component consumes.
      vi.mocked(useParticipantId).mockImplementation((launchId) => ref(launchId ?? PARENT_USER_ID));

      const authStore = useAuthStore();
      // Every component's start watcher and student-data query gate on the access
      // token; `TaskPA` moved off the legacy `isFirekitInit` signal in #2117.
      authStore.accessToken = 'test-token';
      authStore.firebaseUser = { uid: 'parent-firebase-uid' };
    });

    describe('proxy launch', () => {
      it('starts the task instead of rejecting the proxy path', async () => {
        seedSelectedAdmin();

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();
        await flushPromises();

        // Several components used to throw "Proxy-launch path is not yet supported"
        // here, dead-ending every /launch/:launchId route in the generic alert.
        expect(globalThis.alert).not.toHaveBeenCalled();
        expect(initFirekitCompat).toHaveBeenCalled();

        wrapper.unmount();
      });

      it('attributes the run to the child, not the launching user', async () => {
        seedSelectedAdmin();

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
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

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();

        // Regression guard: this query used to be disabled whenever `launchId` was
        // set, so a proxy launch ran with no grade and no DOB.
        const [passedId, queryOptions] = vi.mocked(useUserStudentDataQuery).mock.calls[0];
        expect(toValue(passedId)).toBe(CHILD_USER_ID);
        expect(queryOptions.enabled.value).toBe(true);

        wrapper.unmount();
      });

      it('resolves the variant from the selected administration', async () => {
        seedSelectedAdmin();

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();
        await flushPromises();

        expect(getVariantById).toHaveBeenCalledWith(VARIANT_ID);

        wrapper.unmount();
      });
    });

    describe('self launch', () => {
      it('attributes the run to the launching user when no launchId is given', async () => {
        seedSelectedAdmin();

        const wrapper = mountTask();
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

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();
        await flushPromises();

        // A missing variant must not start a run against the wrong assessment.
        expect(initFirekitCompat).not.toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();

        wrapper.unmount();
      });
    });
  });
}
