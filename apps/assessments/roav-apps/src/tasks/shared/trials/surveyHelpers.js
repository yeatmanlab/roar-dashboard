import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form';
import { mediaAssets } from '../helpers/mediaAssets';
import { jsPsych } from '../helpers/taskSetup';
import { sessionGet } from '../helpers/sessionHelpers';
import { AssessmentStage } from '../helpers/namingHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';

const paramsSurveyRatingRadioDef = {
  title: '',
  subtitle: '',
  nameSurvey: '',
  titlesCol: null, // []
  titlesRow: null, // []
  namesRow: null, // []
  keysImgRow: null, // []
  widthColFirst: 15, // in REM
  widthCol: 5, // in REM
  textBtn: 'NEXT',
};

export const t_surveyRatingRadio = (paramsIn) => {
  const params = { ...paramsSurveyRatingRadioDef, ...paramsIn };

  return {
    type: jsPsychSurveyHtmlForm,
    preamble: `
        <h2>${params.title}</h2>
        <p class="shared-tech-text-medium-neutral">${params.subtitle}<p>
    `,
    html: () => {
      let headers = '';
      for (let iCol = 0; iCol < params.titlesCol.length; iCol += 1) {
        headers += `<th>${params.titlesCol[iCol]}</th>`;
      }

      let rows = '';
      for (let iRow = 0; iRow < params.namesRow.length; iRow += 1) {
        let cols = '';
        for (let iCol = 0; iCol < params.titlesCol.length; iCol += 1) {
          cols += `<td><input type="radio" 
            name="${params.namesRow[iRow]}" 
            value="${iCol}"
            required>
          </td>`;
        }
        if (params.keysImgRow) {
          rows += `
          <tr><td>
            <img src="${mediaAssets.images[params.keysImgRow[iRow]]}" class="cr-survey-img">
          </td>${cols}</tr>`;
        } else if (params.titlesRow) {
          rows += `<tr><td>${params.titlesRow[iRow]}</td>${cols}</tr>`;
        }
      }

      return `
        <style>
          .cr-survey-table {
            font-family:inherit;
            border-collapse: collapse;
            margin-left: -${params.widthColFirst}rem;
            margin-top: 2rem;
            margin-bottom: 2rem;
            input[type="radio"] { width: 1rem; height: 1rem; }
            th, td { padding-left: 3rem; padding-bottom: 1.5rem; }
            th { width: ${params.widthCol}rem }
            .cr-survey-img { border: 1px solid black; width: ${params.widthColFirst}rem; }
          }
        </style>
        <table class="cr-survey-table">
          <thead><tr><th></th>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <input type="submit" 
          value="${params.textBtn}" 
          class="shared-tech-button-small">
        `;
    },
    button_label: '',
    on_load: () => {
      document.querySelector('#jspsych-survey-html-form-next').style.display = 'none';
    },
    on_finish: (data) => {
      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: 'survey-rating-radio',
        id_trial: 'survey-rating-radio',
        pid: sessionGet(SK.CONFIG).pid,
        name_survey: params.nameSurvey,
        resp: data.response,
      });
    },
  };
};

const paramsSurveyTextDef = {
  title: '',
  subtitle: '',
  nameSurvey: '',
  textPlaceholder: 'Type here...',
  textBtn: 'NEXT',
};

export const t_surveyText = (paramsIn) => {
  const params = { ...paramsSurveyTextDef, ...paramsIn };

  return {
    type: jsPsychSurveyHtmlForm,
    preamble: `
      <h2>${params.title}</h2>
      <p class="shared-tech-text-medium-neutral">${params.subtitle}</p>
    `,
    html: () => `
      <textarea
        name="text-response"
        style="width:40rem; 
          height:20rem; 
          margin-top: 2rem;
          margin-bottom:5rem;
          font-family:inherit; 
          font-size:1.25rem;
          line-height: 1.5;
          padding: 1rem;
          "
        placeholder="${params.textPlaceholder}"></textarea>
      <br>
      <br>
      <input type="submit" 
        value="${params.textBtn}" 
        class="shared-tech-button-small">
    `,
    button_label: '',
    on_load: () => {
      document.querySelector('#jspsych-survey-html-form-next').style.display = 'none';
    },
    on_finish: (data) => {
      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: 'survey-text',
        id_trial: 'survey-text',
        pid: sessionGet(SK.CONFIG).pid,
        name_survey: params.nameSurvey,
        resp: data.response,
      });
    },
  };
};
