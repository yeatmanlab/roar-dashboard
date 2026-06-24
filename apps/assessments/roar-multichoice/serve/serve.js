import { RoarAppkit, initializeFirebaseProject } from "@bdelab/roar-firekit";
// eslint-disable-next-line import/no-extraneous-dependencies
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import i18next from "i18next";
import RoarMultichoice from "../src/experiment/index";
import { roarConfig } from "./firebaseConfig";
// Import necessary for async in the top level of the experiment script
import "regenerator-runtime/runtime";

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);
const userMode = urlParams.get("mode");
const task = urlParams.get("task") ?? "morphology";
const recruitment = urlParams.get("recruitment");
const assessmentPid =
  urlParams.get("PROLIFIC_PID") || urlParams.get("participant");
const audioFeedback = urlParams.get("feedback");
const numAdaptive =
  urlParams.get("numAdaptive") === null
    ? null
    : parseInt(urlParams.get("numAdaptive"), 10);
const numNew =
  urlParams.get("numNew") === null
    ? null
    : parseInt(urlParams.get("numNew"), 10);
const numValidated =
  urlParams.get("numValidated") === null
    ? null
    : parseInt(urlParams.get("numValidated"), 10);
const maxTime =
  urlParams.get("maxTime") === null
    ? null
    : parseInt(urlParams.get("maxTime"), 10); // time limit for real trials
const nStartItems =
  urlParams.get("nStartItems") === null
    ? null
    : parseInt(urlParams.get("nStartItems"), 10);

const forceSecondaryBehavior = urlParams.has("forceSecondaryBehavior")
  ? urlParams.get("forceSecondaryBehavior") === "true"
  : undefined;

export const labId = urlParams.get("labId");
const birthYear = urlParams.get("birthyear");
const birthMonth = urlParams.get("birthmonth");
const age = urlParams.get("age");
const ageMonths = urlParams.get("agemonths");
const grade = urlParams.get("grade")
  ? parseInt(urlParams.get("grade"), 10)
  : null;
const practiceCorpus = urlParams.get("practiceCorpus");
const stimulusCorpus = urlParams.get("stimulusCorpus");
const buttonLayout = urlParams.get("buttonLayout");
const numberOfTrials = parseInt(urlParams.get("trials"), 10) || null;
const promptWidth = urlParams.get("width") ?? "75";
const startItemSelect = urlParams.get("startItemSelect") ?? "random";
const consent = urlParams.get("consent")?.toLocaleLowerCase() !== "false";
const skipInstructions = urlParams.get("skip")?.toLocaleLowerCase() !== "true";
const sequentialPractice =
  JSON.parse(urlParams.get("sequentialPractice")) ?? true;
const sequentialStimulus =
  JSON.parse(urlParams.get("sequentialStimulus")) ?? false;
const corpusId = stimulusCorpus;
const isAdaptive = urlParams.get("isAdaptive")?.toLocaleLowerCase() === "true";
const selectionAlgorithm = isAdaptive
  ? "adaptive"
  : urlParams.get("algorithm") ?? "random";
const scoringVersion =
  urlParams.get("scoringVersion") === null
    ? isAdaptive
      ? 1
      : null
    : parseInt(urlParams.get("scoringVersion"), 10);
const { language } = i18next;

// @ts-ignore
const appKit = await initializeFirebaseProject(
  roarConfig.firebaseConfig,
  "assessmentApp",
  "none",
);

const taskId = language === "en" ? task : `${task}-${language}`;

onAuthStateChanged(appKit.auth, (user) => {
  if (user) {
    const userInfo = {
      assessmentPid,
      assessmentUid: user.uid,
      userMetadata: {
        districtId: "",
      },
    };

    const userParams = {
      assessmentPid,
      labId,
      birthMonth,
      birthYear,
      age,
      ageMonths,
      grade,
    };

    const gameParams = {
      userMode,
      task,
      recruitment,
      skipInstructions,
      consent,
      audioFeedback,
      numAdaptive,
      numNew,
      numValidated,
      maxTime,
      nStartItems,
      practiceCorpus,
      stimulusCorpus,
      corpusId,
      sequentialPractice,
      sequentialStimulus,
      buttonLayout,
      numberOfTrials,
      promptWidth,
      startItemSelect,
      selectionAlgorithm,
      isAdaptive,
      scoringVersion,
      ...(forceSecondaryBehavior !== undefined && { forceSecondaryBehavior }),
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

    const roarApp = new RoarMultichoice(firekit, gameParams, userParams);
    roarApp.run();
  }
});

await signInAnonymously(appKit.auth);
