import { RoarAppkit, initializeFirebaseProject } from "@bdelab/roar-firekit";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import ReadAloudTask from "../src/experiment/index";
import { firebaseConfig } from "./firebaseConfig";
import { stringToBoolean } from "../src/experiment/helperFunctions";
// Import necessary for async in the top level of the experiment script
import "regenerator-runtime/runtime";

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);
const taskName = urlParams.get("taskName") ?? "roar-readaloud";
const viewType = urlParams.get("viewType") ?? "detailed";
const assessmentPid = urlParams.get("participant") ?? "";
const viewingDistance = parseInt(urlParams.get("viewingDistance") ?? "50");

const deviceConfigFile = urlParams.get("deviceConfigFile") ?? "devices_default";
const bViewingDistancePage = stringToBoolean(
  urlParams.get("bViewingDistancePage"),
  false,
);
const calibrationType = urlParams.get("calibrationType") ?? "short";
const bEyeTracking = stringToBoolean(urlParams.get("bEyeTracking"), true);
const storeVideo = stringToBoolean(urlParams.get("storeVideo"), true);
const testConfigFile = urlParams.get("testConfigFile") ?? "phonicsA_tests";

const visibleEyeTracking = stringToBoolean(
  urlParams.get("visibleEyeTracking"),
  false,
);
const practiceCorpus = urlParams.get("practiceCorpus");
const stimulusCorpus = urlParams.get("stimulusCorpus");
const storyCorpus = urlParams.get("storyCorpus");
const buttonLayout = urlParams.get("buttonLayout");
const numOfPracticeTrials =
  urlParams.get("practiceTrials") === null
    ? null
    : parseInt(urlParams.get("practiceTrials"), 10);
const numberOfTrials =
  urlParams.get("trials") === null
    ? null
    : parseInt(urlParams.get("trials"), 10);
const stimulusBlocks =
  urlParams.get("blocks") === null
    ? null
    : parseInt(urlParams.get("blocks"), 10);
// Boolean parameters
const consent = stringToBoolean(urlParams.get("consent"), false);
const keyHelpers = stringToBoolean(urlParams.get("keyHelpers"), true);
const story = stringToBoolean(urlParams.get("story"), false);
const skipInstructions = stringToBoolean(urlParams.get("skip"), true);
const sequentialPractice = stringToBoolean(
  urlParams.get("sequentialPractice"),
  true,
);
const sequentialStimulus = stringToBoolean(
  urlParams.get("sequentialStimulus"),
  true,
);

// @ts-ignore
const appKit = await initializeFirebaseProject(
  firebaseConfig,
  "assessmentApp",
  "none",
);

const taskId = "roar-readaloud";

// const taskId =
// language === "en" ? "roar-readaloud" : `${"roar-readaloud"}-${language}`;

onAuthStateChanged(appKit.auth, (user) => {
  if (user) {
    const userInfo = {
      assessmentUid: user.uid,
      assessmentPid: assessmentPid,
      userMetadata: {},
    };

    const userParams = {};

    const gameParams = {
      consent,
      taskName,
      viewType,
      viewingDistance,
      storeVideo,
      deviceConfigFile,
      testConfigFile,
      bEyeTracking,
      bViewingDistancePage,
      calibrationType,
      visibleEyeTracking,
      skipInstructions,
      practiceCorpus,
      stimulusCorpus,
      sequentialPractice,
      sequentialStimulus,
      buttonLayout,
      numOfPracticeTrials,
      numberOfTrials,
      story,
      storyCorpus,
      stimulusBlocks,
      keyHelpers,
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

    const app = new ReadAloudTask(firekit, gameParams, userParams);
    app.run();
  }
});

await signInAnonymously(appKit.auth);
