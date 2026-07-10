import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form'; //set of inputs
import store from 'store2'; //storing session data
import { getAgeData } from '@bdelab/roar-utils';
import { updateUser } from '@roar-platform/assessment-sdk/compat/firekit';

const survey_responseModality = {
  type: jsPsychSurveyHtmlForm,
  preamble: () => `<div><h1>Thank you for completing this study! Please share a little more information with us.</h3>`,
  html: () => `
    <div className="item">
    <span htmlFor="instructions" class = "survey_form_text">How old are you? (Please type a number)</span>
    <input type = "text" id = "age" name="age" style = "font-size: 2vh" value=""/>
    </div>
    <br>
    <div className="item">
    <span class = "survey_form_text">What is your current grade or highest level of education?</span>
    <select id = "edu" name = "edu" style = "font-size: 2vh">
        <option value=""></option>
        <option value="prek">preK</option>
        <option value="k1">K1</option>
        <option value="k2">K2</option>
        <option value="1">Grade 1</option>
        <option value="2">Grade 2</option>
        <option value="3">Grade 3</option>
        <option value="4">Grade 4</option>
        <option value="5">Grade 5</option>
        <option value="6">Grade 6</option>
        <option value="7">Grade 7</option>
        <option value="8">Grade 8</option>
        <option value="9">Grade 9</option>
        <option value="10">Grade 10</option>
        <option value="11">Grade 11</option>
        <option value="12">Grade 12</option>
        <option value="college">College</option>
        <option value="proSchool">Professional School</option>
        <option value="gradSchool">Graduate School</option>
    </select>
    </div>
    <br>
    <div className="item">
    <span class = "survey_form_text">Is English your first language?</span>
    <select id = "ell" name = "ell" style = "font-size: 2vh">
        <option value=""></option>
        <option value="1">No</option>
        <option value="0">Yes</option>
    </select>
    </div>
    <br>
    <div className="item">
    <span class = "survey_form_text">Did you complete all of your schooling in the US (kindergarten to 12th grade)?</span>
    <select id = "schooling" name = "schooling" style = "font-size: 2vh">
        <option value=""></option>
        <option value="no">No</option>
        <option value="yes">Yes</option>
    </select>
    </div>
    <br>`,
  autocomplete: true,
  on_start: () => {
    document.body.style.cursor = 'auto';
  },
  on_load: () => {
    document.getElementById('jspsych-survey-html-form-next').value = 'Finish';
  },
  on_finish: (data) => {
    const tmpMetadata = {};
    Object.keys(data.response).forEach((field) => {
      if (data.response[field] === '') {
        tmpMetadata[field] = null;
      } else if (field === 'retake' || field === 'ell') {
        tmpMetadata[field] = parseInt(data.response[field], 10);
      } else {
        tmpMetadata[field] = data.response[field];
      }
    });
    tmpMetadata.labId = store.session.get('config').labId;

    const config = store.session.get('config');
    const ageData = getAgeData(null, null, tmpMetadata.age);
    config.userMetadata = {
      ...config.userMetadata,
      ...tmpMetadata,
      ...ageData,
    };
    store.session.set('config', config);
  },
};

export const surveyTimeline = (configMain) => {
  const beginningTimeline = {
    timeline: [survey_responseModality],
    on_timeline_finish: async () => {
      const config = store.session.get('config');
      try {
        await updateUser({
          assessmentPid: config.pid,
          labId: config.labId,
          ...config.userMetadata,
        });
      } catch (err) {
        console.error('[roam-apps] updateUser failed (non-fatal):', err);
      }
    },
  };

  return beginningTimeline;
};
