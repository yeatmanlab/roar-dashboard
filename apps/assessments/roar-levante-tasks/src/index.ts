import {
  isTaskFinished,
  getMediaAssets,
  dashToCamelCase,
  showLevanteLogoLoading,
  hideLevanteLogoLoading,
  combineMediaAssets,
  getAssetsPerTask,
  filterMedia,
  getRoarMediaAssets,
  getRoarTranslations,
} from './tasks/shared/helpers';
import './styles/index.scss';
import taskConfig from './tasks/taskConfig';
import { startRun, initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
// @ts-ignore: facade is a plain JS file without type declarations
import { wireScoreAdapter } from './sdk/levante-firekit-facade.js';
import { setTaskStore, taskStore } from './taskStore';
import { InitPageSetup, Logger } from './utils';
// @ts-ignore: Need to keep sentry as .js file to use new function-based API
import { initSentry } from './sentry.js';
import { getBucketName } from './tasks/shared/helpers/getBucketName';
import { TASK_BUCKET_NAMES_ORIGINAL } from './tasks/shared/helpers/constants';
import camelCase from 'lodash/camelCase';

export let mediaAssets: MediaAssetsType;
// let sharedMediaAssets: MediaAssetsType;
let languageAudioAssets: MediaAssetsType;
let sharedAudioAssets: MediaAssetsType;
let taskVisualAssets: MediaAssetsType;
let sharedVisualAssets: MediaAssetsType;

/**
 * Host-supplied SDK wiring. Derived from `initFirekitCompat`'s own signature so the shape
 * cannot drift from the SDK it is passed to.
 */
interface AssessmentSdkContext {
  ctx: Parameters<typeof initFirekitCompat>[0];
  taskInfo: Parameters<typeof initFirekitCompat>[1];
}

export class TaskLauncher {
  gameParams: GameParamsType;
  userParams: UserParamsType;
  isDev: boolean;
  logger?: LevanteLogger;
  sdkContext?: AssessmentSdkContext;

  /**
   * @param gameParams - Variant parameters. Ignored in favour of the variant's own parameters
   *   when `sdkContext` is supplied — pass `{}` in that case.
   * @param userParams - Participant/session parameters, forwarded as run metadata.
   * @param isDev - Dev-mode flag.
   * @param logger - Optional host logger, installed once `gameParams` are resolved.
   * @param sdkContext - Host-supplied SDK wiring. When present this class owns SDK
   *   initialization and variant resolution. When absent the host must call
   *   `initFirekitCompat` itself and pass resolved variant parameters as `gameParams`.
   */
  constructor(
    gameParams: GameParamsType,
    userParams: UserParamsType,
    isDev = false,
    logger?: LevanteLogger,
    sdkContext?: AssessmentSdkContext,
  ) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.isDev = isDev;
    this.logger = logger;
    this.sdkContext = sdkContext;

    // `initFirekitCompat` is synchronous, so initializing here rather than in `run()` keeps the
    // facade ready before any other method can touch it. Skipped when the host retains
    // ownership of SDK setup.
    if (sdkContext) {
      initFirekitCompat(sdkContext.ctx, sdkContext.taskInfo);
    }

    // Logger installation moved to `run()`: it snapshots `gameParams` for every captured event,
    // and when the host hands over its context those are not resolved until then.
  }

  /**
   * Resolves the run's variant parameters through the SDK when the host handed over its context.
   *
   * No-op otherwise, so a host that has not migrated keeps supplying `gameParams` itself.
   */
  async _resolveGameParams(): Promise<void> {
    if (!this.sdkContext) return;

    const { variantParams } = await getVariantById(this.sdkContext.taskInfo.variantId);
    // The variant is the authority on game parameters; anything the host passed is a fallback.
    // See .ai/rules/assessment-integration-pattern.md.
    //
    // The assertion papers over a pre-existing inaccuracy rather than introducing one:
    // `GameParamsType` is `Record<string, string>`, but seeded variant params legitimately
    // carry numbers and booleans, and the SDK types them `Record<string, unknown>`. serve.js
    // has always passed exactly this value in — being JavaScript, it was never checked.
    // Widening `GameParamsType` to `Record<string, unknown>` is the real fix. The surface is
    // small — the alias in types/index.d.ts, the `taskName`/`language` reads below and in the
    // telemetry payload, and the signatures in helpers/config.ts and utils/logger.ts — but it
    // is narrowing work unrelated to this change, so it is left for its own.
    this.gameParams = { ...this.gameParams, ...variantParams } as GameParamsType;
  }

  async init() {
    initSentry();
    wireScoreAdapter();
    // Pass userParams (demographics / lab identifiers from serve.js) as run metadata,
    // matching the other assessments.
    await startRun(this.userParams);

    const { taskName } = this.gameParams;
    let { language } = this.gameParams;
    // Default to English when no language is supplied by the variant params.
    if (!language) {
      language = 'en';
    }
    taskStore('language', language);

    // Levante handling
    // adding this to handle legacy two letter language codes in variant docs
    if (language === 'es') {
      language = 'es-CO';
    } else if (language === 'en') {
      language = 'en-US';
    } else if (language === 'de') {
      language = 'de-DE';
    }

    const { setConfig, getCorpus, buildTaskTimeline, getTranslations } =
      taskConfig[dashToCamelCase(taskName) as keyof typeof taskConfig];

    const isDev = this.isDev;
    const useRoarHfBucket = taskName === 'hearts-and-flowers';

    let taskVisualBucket, sharedVisualBucket, languageAudioBucket, sharedAudioBucket;
    if (taskName !== 'roar-inference' && taskName !== 'trog') {
      taskVisualBucket = getBucketName(taskName, isDev, 'visual', language, useRoarHfBucket);
      sharedVisualBucket = getBucketName('shared', isDev, 'visual', language, useRoarHfBucket);
      languageAudioBucket = getBucketName('shared', isDev, 'audio', language, useRoarHfBucket);
      sharedAudioBucket = getBucketName('shared', isDev, 'audio', 'shared', useRoarHfBucket);
    }

    try {
      if (taskName === 'roar-inference' || taskName === 'trog') {
        // ROAR buckets use only the language code, not the full locale
        language = language.includes('-') ? language.split('-')[0] : language;
        mediaAssets = await getRoarMediaAssets(
          TASK_BUCKET_NAMES_ORIGINAL[camelCase(taskName) as keyof typeof TASK_BUCKET_NAMES_ORIGINAL],
          {},
          language,
        );
      } else {
        languageAudioAssets = await getMediaAssets(languageAudioBucket!, {}, language, taskName);
        sharedAudioAssets = await getMediaAssets(sharedAudioBucket!, {}, 'shared', taskName);
        taskVisualAssets = await getMediaAssets(taskVisualBucket!, {}, language, taskName);
        sharedVisualAssets = await getMediaAssets(sharedVisualBucket!, {}, language, 'shared');
      }
    } catch (error) {
      throw new Error('Error fetching media assets: ' + error);
    }

    const config = await setConfig(this.gameParams, this.userParams);

    setTaskStore(config);

    if (taskName === 'roar-inference' || taskName === 'trog') {
      await getRoarTranslations(language);
    } else {
      await getTranslations(isDev, taskName, language);
    }

    // TODO: make hearts and flowers corpus? make list of tasks that don't need corpora?
    if (taskName !== 'hearts-and-flowers' && taskName !== 'memory-game' && taskName !== 'intro') {
      await getCorpus(config, isDev);
    }

    if (taskName !== 'roar-inference' && taskName !== 'trog') {
      await getAssetsPerTask(isDev, useRoarHfBucket);

      const taskAudioAssetNames = [
        ...taskStore().assetsPerTask[taskName].audio,
        ...taskStore().assetsPerTask.shared.audio,
      ];

      // filter out language audio not relevant to current task
      languageAudioAssets = filterMedia(languageAudioAssets, [], taskAudioAssetNames, []);

      mediaAssets = combineMediaAssets([languageAudioAssets, sharedAudioAssets, taskVisualAssets, sharedVisualAssets]);
    }

    // Expose resolved media assets for e2e validation (dev/test only)
    if (typeof window !== 'undefined') {
      (window as any).__mediaAssets = mediaAssets;
    }

    return buildTaskTimeline(config, mediaAssets);
  }

  async run() {
    await this._resolveGameParams();
    // Installed here, not in the constructor: `capture()` snapshots gameParams on every event,
    // so it has to see the resolved variant params. Runs before `init()`, which is the earliest
    // point anything downstream calls `Logger.getInstance()`.
    Logger.setInstance(this.logger, this.gameParams, this.userParams);
    showLevanteLogoLoading();
    const { jsPsych, timeline } = await this.init();
    hideLevanteLogoLoading();
    const logger = Logger.getInstance();
    logger.capture('Task Launched', {
      taskName: this.gameParams.taskName,
      language: this.gameParams.language,
      gameParams: this.gameParams,
      userParams: this.userParams,
    });
    jsPsych.run(timeline);
    const translations = taskStore().translations;
    const pageSetup = new InitPageSetup(4000, translations);
    taskStore('pageSetup', pageSetup);

    pageSetup.init();
    await isTaskFinished(() => taskStore().taskComplete);
  }
}
