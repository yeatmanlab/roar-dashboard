import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form';
import store from 'store2';
import i18next from 'i18next';
import '../i18n';
// import { islangaugeUndefined } from "../i18n";

// eslint-disable-next-line no-unused-vars
const languageSelectTrial = {
  type: jsPsychSurveyHtmlForm,
  preamble: `
        <div>
            <h1>Looks like we couldn't detect what your default browser langauge is.</h1>
            <h1>Please select the langauge you are most fluent in.</h1>
        </div>
        `,
  html: `
        <select id="languageSelect" name="language">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="de">German</option>
        </select>
    `,
  button_label: 'Continue',
  on_load: () => {
    const formContainer = document.getElementById('jspsych-survey-html-form');
    formContainer.classList.add('languageForm');

    document.getElementById('languageSelect').style.fontSize = '2vh';
  },
  on_finish: async (data) => {
    await i18next.changeLanguage(`${data.response.language}`);
    store.session.set('language', i18next.language);
  },
};

// export const ifLangDetectFail = {
//     timeline: [languageSelectTrial],
//     conditional_function: () => islangaugeUndefined
// }
