import { RoarAppkit, initializeFirebaseProject } from "@bdelab/roar-firekit";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import TaskLauncher from "../src/experiment/index";
import { firebaseConfig } from "./firebaseConfig";
import i18next from "i18next";
import {
  checkBoolean,
  stringToBoolean,
} from "../src/experiment/tasks/shared/helpers/helperFunctions";
// Import necessary for async in the top level of the experiment script
import "regenerator-runtime/runtime";

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);
const taskName = urlParams.get("taskName") ?? "ran";
const viewType = urlParams.get("viewType") ?? "simple";
const assessmentPid = urlParams.get("participant") ?? "";

const deviceConfigFile = urlParams.get("deviceConfigFile") ?? "devices_howard";
const calibrationType = urlParams.get("calibrationType") ?? "short";
const bEyeTracking = stringToBoolean(urlParams.get("bEyeTracking"), false);
const storeVideo = stringToBoolean(urlParams.get("storeVideo"), false);
const testConfigFile = urlParams.get("testConfigFile") ?? "tests";

const practiceCorpus = urlParams.get("practiceCorpus");
const stimulusCorpus = urlParams.get("stimulusCorpus");
const storyCorpus = urlParams.get("storyCopus");
const story = stringToBoolean(urlParams.get("story"), true);
const buttonLayout = urlParams.get("buttonLayout");
const numOfPracticeTrials = urlParams.get("practiceTrials");
const numberOfTrials =
  urlParams.get("trials") === null
    ? null
    : parseInt(urlParams.get("trials"), 40);
const stimulusBlocks =
  urlParams.get("blocks") === null
    ? null
    : parseInt(urlParams.get("blocks"), 10);
// Boolean parameters
const consent = stringToBoolean(urlParams.get("consent"), false);
const keyHelpers = stringToBoolean(urlParams.get("keyHelpers"), true);
const grade = urlParams.get("grade");
const storyOption = urlParams.get("storyOption");
const skipInstructions = stringToBoolean(urlParams.get("skip"), true);
const sequentialPractice = stringToBoolean(
  urlParams.get("sequentialPractice"),
  true,
);
const sequentialStimulus = stringToBoolean(
  urlParams.get("sequentialStimulus"),
  true,
);
const { language } = i18next;

// @ts-ignore
const appKit = await initializeFirebaseProject(
  firebaseConfig,
  "assessmentApp",
  "none",
);

const taskId = language === "en" ? taskName : `${taskName}-${language}`;

onAuthStateChanged(appKit.auth, (user) => {
  if (user) {
    const userInfo = {
      assessmentUid: user.uid,
      assessmentPid: assessmentPid,
      userMetadata: {},
    };

    const userParams = {
      grade,
    };

    const gameParams = {
      consent,
      taskName,
      viewType,
      deviceConfigFile,
      testConfigFile,
      calibrationType,
      storeVideo,
      bEyeTracking,
      skipInstructions,
      practiceCorpus,
      stimulusCorpus,
      sequentialPractice,
      sequentialStimulus,
      buttonLayout,
      numOfPracticeTrials,
      numberOfTrials,
      storyOption,
      storyCorpus,
      stimulusBlocks,
      keyHelpers,
      story,
    };

    const taskInfo = {
      taskId: taskId,
      variantParams: gameParams,
    };

    const firekit = new RoarAppkit({
      firebaseProject: appKit,
      taskInfo,
      userInfo,
    });

    const app = new TaskLauncher(firekit, gameParams, userParams);
    app.run();
  }
});

await signInAnonymously(appKit.auth);
