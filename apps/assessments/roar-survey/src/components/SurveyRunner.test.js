import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SurveyRunner from './SurveyRunner.vue';
import {
  startRun,
  writeTrial,
  finishRun,
  initFirekitCompat,
  getVariantById,
} from '@roar-platform/assessment-sdk/compat/firekit';

// SurveyRunner owns SDK initialization, variant resolution, and fetching its own content, so
// these are the seams. survey-core is mocked because the suite is about the resolve/fetch/run
// sequence, not about rendering a questionnaire.
vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  startRun: vi.fn().mockResolvedValue(undefined),
  writeTrial: vi.fn().mockResolvedValue(undefined),
  finishRun: vi.fn().mockResolvedValue(undefined),
  initFirekitCompat: vi.fn(),
  getVariantById: vi.fn(),
}));

vi.mock('survey-core', () => ({
  Model: vi.fn().mockImplementation(() => ({
    applyTheme: vi.fn(),
    onAfterRenderPage: { add: vi.fn() },
  })),
}));

// Stubbed to a fake origin so no real ROAR bucket is written into this suite — matching how
// roar-pa / roar-letter / roar-sre stub their score-table builders. The real origin is pinned
// once, in constants/bucketBaseUrl.test.js.
vi.mock('../constants/bucketBaseUrl', () => ({
  getBucketUrl: (lang = 'en') => `https://example.test/${lang}/`,
}));

vi.mock('survey-vue3-ui', () => ({
  SurveyComponent: { name: 'SurveyComponent', props: ['model'], emits: ['complete'], template: '<div />' },
}));

const CTX = { baseUrl: 'http://localhost:4000', auth: {}, participant: { participantId: 'participant-uuid' } };
const TASK_INFO = { variantId: 'survey-variant-uuid', taskVersion: '1.0', isAnonymous: false };
const SDK_CONTEXT = { ctx: CTX, taskInfo: TASK_INFO };
const SURVEY_JSON = { pages: [] };

// Instrument names are deliberately unmistakable as fixtures. Nothing in this suite should
// read like a real survey file, and the names say which source they came from so the
// precedence assertions below are self-describing.
const VARIANT_SURVEY_FILE = 'test-survey-from-variant';
const HOST_SURVEY_FILE = 'test-survey-from-host';

/** Resolves only when the test calls the returned trigger — used to hold a fetch open. */
function deferred() {
  let resolveIt;
  const promise = new Promise((resolve) => {
    resolveIt = resolve;
  });
  return { promise, resolve: resolveIt };
}

function mountRunner(props = {}) {
  return mount(SurveyRunner, {
    props: { sdkContext: SDK_CONTEXT, ...props },
    global: { components: { ProgressSpinner: { template: '<div />' } } },
  });
}

/** The URL the component fetched its content from, or undefined. */
function fetchedUrl() {
  return globalThis.fetch.mock.calls[0]?.[0];
}

describe('SurveyRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getVariantById).mockResolvedValue({ variantParams: { survey: VARIANT_SURVEY_FILE } });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(SURVEY_JSON) });
  });

  describe('SDK initialization', () => {
    it('initializes the SDK with the host-supplied context', async () => {
      const wrapper = mountRunner();
      await flushPromises();

      expect(initFirekitCompat).toHaveBeenCalledWith(CTX, TASK_INFO);

      wrapper.unmount();
    });

    it('does not initialize, resolve, or fetch when no context is supplied', async () => {
      const wrapper = mountRunner({ sdkContext: null });
      await flushPromises();

      expect(initFirekitCompat).not.toHaveBeenCalled();
      expect(getVariantById).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(startRun).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain("We couldn't load your survey");

      wrapper.unmount();
    });
  });

  describe('choosing the content file', () => {
    it("uses the variant's survey key when the host names no file", async () => {
      const wrapper = mountRunner({ language: 'en' });
      await flushPromises();

      expect(getVariantById).toHaveBeenCalledWith(TASK_INFO.variantId);
      expect(fetchedUrl()).toBe(`https://example.test/en/${VARIANT_SURVEY_FILE}.json`);

      wrapper.unmount();
    });

    it('lets an explicitly named file outrank the variant', async () => {
      // Only standalone sets `surveyFile`, where it is the researcher's deliberate choice of
      // instrument. The dashboard never sets it, so there the assigned variant still decides.
      const wrapper = mountRunner({ surveyFile: HOST_SURVEY_FILE, language: 'en' });
      await flushPromises();

      expect(fetchedUrl()).toBe(`https://example.test/en/${HOST_SURVEY_FILE}.json`);

      wrapper.unmount();
    });

    it('falls back to the default file when neither names one', async () => {
      vi.mocked(getVariantById).mockResolvedValue({ variantParams: {} });

      const wrapper = mountRunner({ language: 'en' });
      await flushPromises();

      // 'survey' is SurveyRunner's module-local DEFAULT_SURVEY_FILE — not importable, and
      // pinning it is exactly what this test is for.
      expect(fetchedUrl()).toBe('https://example.test/en/survey.json');

      wrapper.unmount();
    });

    it('reads content from the requested locale directory', async () => {
      // Regression guard: the language used to be applied by the host, and a bucket URL
      // duplicated in the dashboard was the only thing carrying it.
      const wrapper = mountRunner({ language: 'es' });
      await flushPromises();

      expect(fetchedUrl()).toBe(`https://example.test/es/${VARIANT_SURVEY_FILE}.json`);

      wrapper.unmount();
    });
  });

  describe('run lifecycle', () => {
    it('resolves content before starting the run', async () => {
      const order = [];
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        order.push('fetch');
        return { ok: true, json: vi.fn().mockResolvedValue(SURVEY_JSON) };
      });
      vi.mocked(startRun).mockImplementation(async () => {
        order.push('startRun');
      });

      const wrapper = mountRunner();
      await flushPromises();

      // A content failure must not be able to leave an orphaned run behind.
      expect(order).toEqual(['fetch', 'startRun']);

      wrapper.unmount();
    });

    it('surfaces an error and starts no run when the content fetch fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' });

      const wrapper = mountRunner();
      await flushPromises();

      expect(startRun).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain("We couldn't load your survey");
      expect(console.error).toHaveBeenCalled();

      wrapper.unmount();
    });

    it('does not start a run when the participant navigates away mid-fetch', async () => {
      // The reason the unmount guard exists: an orphaned run, or — if the next task has
      // already started — a second run that repoints runId and sends the real assessment's
      // trials to the wrong place.
      const held = deferred();
      globalThis.fetch = vi.fn().mockReturnValue(held.promise);

      const wrapper = mountRunner();
      await flushPromises();
      expect(startRun).not.toHaveBeenCalled();

      wrapper.unmount();
      held.resolve({ ok: true, json: vi.fn().mockResolvedValue(SURVEY_JSON) });
      await flushPromises();

      expect(startRun).not.toHaveBeenCalled();
    });
  });

  describe('completion', () => {
    it('writes one trial per response, finishes the run, then notifies the host', async () => {
      const wrapper = mountRunner();
      await flushPromises();

      // Driven through the template's `@complete` binding, not by calling the handler
      // directly — deleting that binding should fail this test.
      const survey = wrapper.findComponent({ name: 'SurveyComponent' });
      expect(survey.exists()).toBe(true);
      survey.vm.$emit('complete', { data: { q1: 'yes', q2: 'no' } });
      await flushPromises();

      expect(writeTrial).toHaveBeenCalledTimes(2);
      expect(writeTrial).toHaveBeenCalledWith(
        expect.objectContaining({ questionName: 'q1', response: 'yes', itemIndex: 0 }),
      );
      expect(writeTrial).toHaveBeenCalledWith(
        expect.objectContaining({ questionName: 'q2', response: 'no', itemIndex: 1 }),
      );
      expect(finishRun).toHaveBeenCalledOnce();
      expect(wrapper.emitted('completeSurvey')).toHaveLength(1);

      wrapper.unmount();
    });
  });
});
