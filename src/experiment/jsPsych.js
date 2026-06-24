import { initJsPsych } from "jspsych";
import i18next from "i18next";
import "./i18n";

export const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  message_progress_bar: `${i18next.t("progressBar")}`,
});
