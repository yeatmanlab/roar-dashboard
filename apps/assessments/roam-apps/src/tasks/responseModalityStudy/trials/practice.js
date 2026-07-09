import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../..";
import i18next from "i18next";
import "../../../i18n/i18n";
import { isMobile } from "../../fluency/helpers";
import store from "store2";

export const practice = (subCorpusName, idx) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      let rtControl = store.session.get("blockOrderRT");
      if (subCorpusName === "rtControl_production") {
        if (idx === 0) {
          return mediaAssets.audio.responseModalityPracticeProduction1;
        } else {
          return mediaAssets.audio.responseModalityPracticeProduction2;
        }
      } else {
        if (idx === 0) {
          return mediaAssets.audio.responseModalityPracticeAfc1;
        } else if (idx === 1 && rtControl[0] === "rtControl_production") {
          return mediaAssets.audio.responseModalityPracticeAfc2;
        } else {
          if (subCorpusName === "rtControl_2afc") {
            return mediaAssets.audio.responseModalityPractice2afc;
          } else {
            return mediaAssets.audio.responseModalityPractice6afc;
          }
        }
      }
    },
    prompt: () => {
      let timeText = ``;
      if (idx === 0) {
        let continueText = isMobile
          ? "responseModalityStudy.practice.text10"
          : "responseModalityStudy.practice.text9";
        timeText = `${i18next.t("responseModalityStudy.practice.text6", {
          continue: `${i18next.t(continueText)}`,
        })}`;
      }

      if (subCorpusName === "rtControl_production") {
        let introText = ``;
        if (idx > 0) {
          introText = `${i18next.t("responseModalityStudy.practice.text11")}`;
        }
        return (
          `
        <div class="jspsych-content-modified instructions-bg">
            <h2 class="title">${i18next.t(
              "responseModalityStudy.practice.text1",
            )}</h2>
            <div class="row">
              <div class="instruction-boxes fade-in-1" style="flex-basis: 80%;" id="panel3">
                  <img src="${
                    mediaAssets.images.keyboardExample5
                  }" alt="arrow keys">
                  
              </div>
              <div class="no-box" style="flex-basis: 120%;" id="panel3">
                  <p>` +
          introText +
          `</p><p>${i18next.t("responseModalityStudy.practice.text5")}</p><p>` +
          timeText +
          `</p>
              </div>

            </div>
          </div>
        `
        );
        /*return (
          `
          <div class="jspsych-content-modified instructions-bg">
            <h2 class="title">${i18next.t(
              "responseModalityStudy.practice.text1",
            )}</h2>
            <p class="instructions-text">${i18next.t(
              "responseModalityStudy.practice.text6",
            )}</p>
            <div class="row">
            <div class="instruction-boxes fade-in-1" style="flex-basis: 40%;" id="panel3">
              <img src="${
                      mediaAssets.images.keyboardExample
                    }" alt="arrow keys">
            </div>
            </div>
            <p class="instructions-text">${i18next.t(
              "responseModalityStudy.practice.text3",
            )}</p>
          </div>
          `
          );*/
      } else {
        let imageName = mediaAssets.images.responseTime2afc;
        let imageWidth = "35%";
        let type = "responseModalityStudy.practice.text13";
        let mode = isMobile
          ? "responseModalityStudy.practice.text4"
          : "responseModalityStudy.practice.text3";
        if (subCorpusName === "rtControl_6afc") {
          type = "responseModalityStudy.practice.text14";
          imageName = mediaAssets.images.responseTime6afc;
          imageWidth = "40%";
        }

        let afcInstruction;
        if (store.session.get("rtControlMouseInstruction")) {
          let mode2 = isMobile
            ? "responseModalityStudy.practice.text16"
            : "responseModalityStudy.practice.text15";
          afcInstruction = `<p class="instructions-text">${i18next.t(
            "responseModalityStudy.practice.text12",
            {
              type: `${i18next.t(type)}`,
              mode: `${i18next.t(mode2)}`,
            },
          )}</p>`;
        } else {
          store.session.set("rtControlMouseInstruction", true);
          afcInstruction = `<p class="instructions-text"> ${i18next.t(
            "responseModalityStudy.practice.text2",
            {
              mode: `${i18next.t(mode)}`,
            },
          )}</p>`;
        }
        return (
          `
        <div class="jspsych-content-modified instructions-bg">
          <h2 class="title">${i18next.t(
            "responseModalityStudy.practice.text1",
          )}</h2>
          ` +
          afcInstruction +
          `
          <img class="img-border" src="${imageName}" style="width:` +
          imageWidth +
          `;" alt="response"><p class="instructions-text">` +
          timeText +
          `
        </p></div>
        `
        );
      }
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
    on_finish: () => {
      if (subCorpusName === "production") {
        document.body.style.cursor = "none";
      }
    },
  };
};
