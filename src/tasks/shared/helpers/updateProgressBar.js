import store from "store2";
import { jsPsych } from "../../taskSetup";

export const updateProgressBar = () => {
  //let updateValue = jsPsych.getProgressBarCompleted();
  let endTime = performance.now();
  let totalTime = store.session.get("totalTimePB");

  if (store.session.get("timeOut")) {
    totalTime =
      totalTime + Math.round(endTime - store.session.get("timeOutTime"));
    store.session.set("totalTimePB", totalTime);
  }

  jsPsych.setProgressBar(
    (endTime - store.session.get("startTimePB")) / totalTime,
  );
};
