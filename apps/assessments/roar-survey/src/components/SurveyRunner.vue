<template>
  <!--
    Status copy is slotted, like `uploading` below, because only the host knows the
    participant's language: the dashboard renders these inside a translated session, standalone
    play does not. The defaults keep standalone working without any slot wiring.
  -->
  <template v-if="progressStatus === 'loading'">
    <slot name="loading">
      <p class="status-message">Preparing your survey...</p>
      <ProgressSpinner />
    </slot>
  </template>
  <template v-else-if="progressStatus === 'error'">
    <slot name="error">
      <p class="status-message">We couldn't load your survey</p>
      <p class="status-submessage">Please refresh the page to try again.</p>
    </slot>
  </template>
  <div v-show="progressStatus === 'survey'" class="survey-wrapper">
    <SurveyComponent v-if="surveyModel" :model="surveyModel" @complete="onComplete" />
  </div>
  <template v-if="progressStatus === 'uploading' || progressStatus === 'completed'">
    <slot name="uploading">
      <p class="status-message">Thank you for completing the survey</p>
      <template v-if="progressStatus === 'uploading'">
        <p class="status-submessage">Uploading your answers...</p>
        <p class="status-submessage">Please don't close or refresh the page.</p>
        <ProgressSpinner />
      </template>
    </slot>
  </template>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Model } from 'survey-core';
import { SurveyComponent } from 'survey-vue3-ui';
import {
  startRun,
  writeTrial,
  finishRun,
  abortRun,
  initFirekitCompat,
  getVariantById,
} from '@roar-platform/assessment-sdk/compat/firekit';
import { AssessmentStage } from '@roar-platform/assessment-schema';
import ProgressSpinner from './ProgressSpinner.vue';
import { getBucketUrl } from '../constants/bucketBaseUrl';
import '../styles/survey-runner.css';
import 'survey-core/survey-core.min.css';
import themeJson from '../themes/survey_theme_new.json';
import { insertResponsiveClasses, hideRequiredIndicator, openFullscreen } from '../utils/surveyEventHandlers';

/** Content file used when neither the variant nor the host names one. */
const DEFAULT_SURVEY_FILE = 'survey';

/** Locale used when the host supplies none, or one that is not a plausible locale. */
const DEFAULT_LANGUAGE = 'en';

/** `en`, or `pt-BR` — anything else, notably `../`, must not reach the content path. */
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

/** `survey`, or `survey_grade3` — a bare file name, with no path separators of any kind. */
const SURVEY_FILE_PATTERN = /^[\w-]+$/;

/**
 * Returns `language` if it is a plausible locale, otherwise the default.
 *
 * The value becomes a path segment in the content URL, so an unchecked one escapes the
 * bucket entirely — `../../other-bucket` normalises to a request against `other-bucket`.
 * Validated here rather than in the host because this component is published and builds
 * the URL, so every consumer gets the guard.
 *
 * @param {string} language - Locale supplied by the host
 * @returns {string} A safe locale directory name
 */
function safeLanguage(language) {
  if (LOCALE_PATTERN.test(language)) return language;
  console.warn(`[roar-survey] Ignoring unrecognised language "${language}"; falling back to ${DEFAULT_LANGUAGE}.`);
  return DEFAULT_LANGUAGE;
}

/**
 * Returns `file` if it is a bare content file name, otherwise the default.
 *
 * The same hazard as {@link safeLanguage}, one segment further along the same URL:
 * `?survey=../../other-bucket/evil` escapes the bucket exactly as an unchecked locale would.
 * Applied to the resolved name so the variant's own key is covered too — it arrives from the
 * backend, but this component is published and nothing downstream of here re-checks it.
 *
 * @param {string} file - Content file name resolved from the host or the variant
 * @returns {string} A safe content file name
 */
function safeSurveyFile(file) {
  if (SURVEY_FILE_PATTERN.test(file)) return file;
  console.warn(`[roar-survey] Ignoring unrecognised survey file "${file}"; falling back to ${DEFAULT_SURVEY_FILE}.`);
  return DEFAULT_SURVEY_FILE;
}

const props = defineProps({
  /**
   * Host-supplied SDK wiring, `{ ctx, taskInfo }`. The component owns SDK initialization,
   * variant resolution, and fetching its own content from it.
   *
   * Required in practice: without it there is no variant to resolve and so no content to
   * run, and the component renders its error state. It stays optional only so a host that
   * fails to establish a session can still mount and show that state rather than a blank
   * page — see `main.js`.
   */
  sdkContext: { type: Object, default: null },
  /** Locale directory the survey content is read from. */
  language: { type: String, default: 'en' },
  /**
   * Content file to run when the variant does not name one. Standalone play passes the
   * `?survey=` URL parameter here; the variant's own `survey` key takes precedence.
   */
  surveyFile: { type: String, default: null },
});

const emit = defineEmits(['completeSurvey']);

const progressStatus = ref('loading');
const surveyModel = ref(null);

const onComplete = async (sender) => {
  progressStatus.value = 'uploading';
  const responses = sender.data;

  await Promise.all(
    Object.entries(responses).map(([questionName, answer], index) =>
      writeTrial({
        questionName,
        response: answer,
        itemIndex: index,
        // Surveys have no practice phase — every response is a test-stage trial.
        assessment_stage: AssessmentStage.TEST,
        correct: 1,
      }),
    ),
  );

  await finishRun();
  runOpen = false;
  emit('completeSurvey');
  progressStatus.value = 'completed';
};

const createModel = ({ survey, theme = themeJson, eventHandlers = {} }) => {
  const model = new Model(survey);
  model.applyTheme(theme);
  for (const [eventName, handlers] of Object.entries(eventHandlers)) {
    handlers.forEach((handler) => model[eventName].add(handler));
  }
  return model;
};

/**
 * Resolves which survey to run and fetches its content.
 *
 * The variant is the authority on the content file; `surveyFile` is the standalone fallback
 * for variants that predate the key. Both hosts previously did this themselves, which left
 * the bucket URL duplicated in the dashboard and the file name sourced differently per host.
 *
 * @returns {Promise<object|null>} The survey definition, or null when no context was supplied.
 * @throws {Error} If the content cannot be fetched.
 */
const loadSurvey = async () => {
  if (!props.sdkContext) return null;

  const { variantParams } = await getVariantById(props.sdkContext.taskInfo.variantId);
  // `surveyFile` is only ever set by standalone play, where it is the researcher's explicit
  // choice of instrument and so outranks the variant's default. The dashboard never sets it,
  // so there the assigned variant always decides.
  // `||`, not `??`: `?survey=` with no value yields an empty string, which `??` would keep
  // and turn into a request for `<lang>/.json`.
  const file = safeSurveyFile(props.surveyFile || variantParams.survey || DEFAULT_SURVEY_FILE);

  const response = await fetch(`${getBucketUrl(safeLanguage(props.language))}${file}.json`);
  if (!response.ok) throw new Error(`Survey fetch failed: ${response.statusText}`);
  return response.json();
};

// Content resolution now happens here rather than in the host, so `startRun()` sits behind two
// network round-trips. A participant who navigates away mid-fetch would otherwise still reach
// it, creating an orphaned run — or, if the next task has already started, a second run that
// repoints `runId` and sends the real assessment's trials to the wrong place.
let cancelled = false;

/** True between this component's own `startRun()` and whatever closes that run. */
let runOpen = false;

/**
 * Closes a run this component opened and nobody finished.
 *
 * Gated on `runOpen` rather than calling `abortRun()` unconditionally, because the compat facade
 * is a module-level singleton: an unconditional abort on unmount could close a run belonging to
 * whatever mounted next. `finishRun()` clears the facade's run id, so a completed survey leaves
 * nothing here to close.
 */
function abortOpenRun() {
  if (!runOpen) return;
  runOpen = false;
  abortRun();
}

onUnmounted(() => {
  cancelled = true;
  abortOpenRun();
});

onMounted(async () => {
  // Earliest lifecycle hook, so nothing here can have touched the SDK before this point.
  if (props.sdkContext) {
    initFirekitCompat(props.sdkContext.ctx, props.sdkContext.taskInfo);
  }

  try {
    const survey = await loadSurvey();
    if (cancelled) return;
    if (!survey) throw new Error('No survey content available to run.');

    // Content is resolved before the run starts so a fetch failure cannot leave an orphaned
    // run behind — the ordering both hosts had while they fetched the content themselves.
    await startRun();
    runOpen = true;
    // Unmount can land either side of this await. After it, the handler above has already run
    // and found no run to close, so closing it is this branch's job.
    if (cancelled) {
      abortOpenRun();
      return;
    }

    surveyModel.value = createModel({
      survey,
      eventHandlers: {
        onAfterRenderPage: [insertResponsiveClasses, hideRequiredIndicator, openFullscreen],
      },
    });
    progressStatus.value = 'survey';
  } catch (error) {
    console.error('[roar-survey] Failed to start the survey:', error);
    progressStatus.value = 'error';
  }
});
</script>
