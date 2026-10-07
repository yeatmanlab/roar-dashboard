import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, toValue } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useParticipantId from '@/composables/useParticipantId';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';

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
 * spies this helper sees are the same ones the component calls. The launcher is
 * the exception — each assessment package is a different module specifier, and
 * some export it as `default` while others export a named `TaskLauncher`, so the
 * spec passes its own mock in.
 *
 * Since #2016 the component no longer initializes the SDK itself: it hands the
 * assessment a `{ ctx, taskInfo }` context, and the assessment initializes its
 * own copy. The contract asserted here is unchanged — right participant, right
 * variant, right administration — only its observation point moved.
 *
 * @param {Object} options
 * @param {String} options.name – Component name, used for the describe block.
 * @param {Object} options.component – The task component under test.
 * @param {String} options.taskSlug – Catalog slug the router passes as `taskId`;
 *   the component matches it against the administration's embedded `taskSlug`.
 * @param {Function} options.launcher – The spec's mocked assessment launcher.
 * @param {Number} options.contextArgIndex – Zero-based position of `sdkContext` in that
 *   assessment's constructor. Pinned per spec rather than located by shape: the launcher is
 *   mocked, so nothing else exercises the real arity, and a context landing one slot early
 *   (SRE/SWR's `useParameterValidation`, roam/levante's `logger`) would silently skip
 *   `initFirekitCompat` and create no run at all.
 * @param {Object} [options.props] – Extra props the route supplies (e.g. `language`).
 */
export function describeTaskProxyLaunch({ name, component, taskSlug, launcher, contextArgIndex, props = {} }) {
  describe(`${name} proxy-launch contract`, () => {
    // The component must resolve the same store instances the test seeds, so the
    // active pinia and the one installed on the mount have to be identical.
    let pinia;

    /** @returns {Array} The launcher's first constructor call arguments, or []. */
    function launchArgs() {
      const [args = []] = vi.mocked(launcher).mock.calls;
      return args;
    }

    /**
     * The SDK context, read from the exact slot the assessment declares it in.
     *
     * @returns {Object|undefined} The `{ ctx, taskInfo }` handed over, if any.
     */
    function handedOverContext() {
      return launchArgs()[contextArgIndex];
    }

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
        expect(launcher).toHaveBeenCalled();

        wrapper.unmount();
      });

      it('attributes the run to the child, not the launching user', async () => {
        seedSelectedAdmin();

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();
        await flushPromises();

        const sdkContext = handedOverContext();
        expect(sdkContext?.ctx).toEqual(expect.objectContaining({ participant: { participantId: CHILD_USER_ID } }));
        expect(sdkContext?.taskInfo).toEqual(
          expect.objectContaining({ administrationId: ADMINISTRATION_ID, isAnonymous: false, variantId: VARIANT_ID }),
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

      it('hands the context in the constructor slot the assessment reads it from', async () => {
        seedSelectedAdmin();

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();
        await flushPromises();

        const args = launchArgs();
        expect(args[contextArgIndex]).toEqual(
          expect.objectContaining({ ctx: expect.any(Object), taskInfo: expect.any(Object) }),
        );
        // Arity is pinned too: dropping an `undefined` placeholder shifts the context into the
        // preceding parameter, which reads as harmless and silently disables SDK init.
        expect(args).toHaveLength(contextArgIndex + 1);

        wrapper.unmount();
      });

      it("hands the administration's variant to the assessment", async () => {
        seedSelectedAdmin();

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();
        await flushPromises();

        // The dashboard identifies the variant; the assessment resolves its parameters.
        expect(handedOverContext()?.taskInfo).toEqual(expect.objectContaining({ variantId: VARIANT_ID }));

        wrapper.unmount();
      });
    });

    describe('self launch', () => {
      it('attributes the run to the launching user when no launchId is given', async () => {
        seedSelectedAdmin();

        const wrapper = mountTask();
        await flushPromises();
        await flushPromises();

        expect(handedOverContext()?.ctx).toEqual(
          expect.objectContaining({ participant: { participantId: PARENT_USER_ID } }),
        );

        wrapper.unmount();
      });
    });

    describe('when the task is not in the selected administration', () => {
      it('does not hand a context to the assessment', async () => {
        seedSelectedAdmin('some-other-task');

        const wrapper = mountTask({ launchId: CHILD_USER_ID });
        await flushPromises();
        await flushPromises();

        // A missing variant must not start a run against the wrong assessment.
        expect(launcher).not.toHaveBeenCalled();
        expect(globalThis.alert).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();

        wrapper.unmount();
      });
    });
  });
}
