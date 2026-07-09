import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../.."; //media files
import i18next from "i18next";
import "../../../i18n/i18n";

import { getDevice } from "@bdelab/roar-utils";

export const navigationInstruction = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.navigationInstruction;
  },
  prompt: () => {
    let isMobile = getDevice() === "mobile";
    let mode = "navigation.text3";
    if (isMobile) {
      mode = "navigation.text4";
    }
    return `
      <div>
            <h3>${i18next.t("navigation.text1")}</h3>
            <h4>${i18next.t("navigation.text2", {
              mode: `${i18next.t(mode)}`,
            })}</h4>
            </div>
      `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    `<img class="go-button" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    document.body.style.cursor = "auto";
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  },
};
