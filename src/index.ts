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
  isRoarApp,
} from './tasks/shared/helpers';
import './styles/index.scss';
import taskConfig from './tasks/taskConfig';
import { RoarAppkit } from '@bdelab/roar-firekit';
import { setTaskStore } from './taskStore';
import { taskStore } from './taskStore';
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

export class TaskLauncher {
  gameParams: GameParamsType;
  userParams: UserParamsType;
  firekit: RoarAppkit;
  logger?: LevanteLogger;
  constructor(firekit: RoarAppkit, gameParams: GameParamsType, userParams: UserParamsType, logger?: LevanteLogger) {
    this.gameParams = gameParams;
    this.userParams = userParams;
    this.firekit = firekit;
    Logger.setInstance(logger, gameParams, userParams);
  }

  async init() {
    initSentry();
    await this.firekit.startRun();

    const { taskName } = this.gameParams;
    let { language } = this.gameParams;
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

    const isDev = this.firekit.firebaseProject?.firebaseApp?.options?.projectId === 'gse-roar-assessment-dev';
    const useRoarHfBucket = isRoarApp(this.firekit) && taskName === 'hearts-and-flowers';

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

    const config = await setConfig(this.firekit, this.gameParams, this.userParams);

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
    await isTaskFinished(() => this.firekit?.run?.completed === true && taskStore().taskComplete);
  }
}
