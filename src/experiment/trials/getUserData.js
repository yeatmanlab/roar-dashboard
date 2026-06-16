import jsPsychSurveyText from '@jspsych/plugin-survey-text';
import jsPsychSurveyMultiSelect from '@jspsych/plugin-survey-multi-select';
import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import i18next from 'i18next';
import { getAgeData, getGrade } from '@bdelab/roar-utils';
import '../i18n';
import { isMobile } from '../experimentHelpers';
import { mediaAssets } from '../experiment';
import { getStoryOption } from '../config/config';

const gradeChoices = [
  i18next.t('grades.1'),
  i18next.t('grades.2'),
  i18next.t('grades.3'),
  i18next.t('grades.4'),
  i18next.t('grades.5'),
  i18next.t('grades.6'),
  i18next.t('grades.7'),
  i18next.t('grades.8+'),
];
const getLabId = {
  type: jsPsychSurveyText,
  questions: [
    {
      prompt: i18next.t('labID'),
      name: 'labId',
      required: true,
    },
  ],
  button_label: i18next.t('buttonLabel'),
  css_classes: ['jspsych-content-modified'],
  on_finish: (data) => {
    const config = store.session.get('config');
    config.labId = data.response.labId;
    store.session.set('config', config);
  },
};

const ifGetLabId = {
  timeline: [getLabId],
  conditional_function: () =>
    !store.session.get('config').labId && store.session.get('config').recruitment === 'otherLabs',
};

// If the participant's ID was **not** supplied through the query string, then
// ask the user to fill out a form with their ID, class and school.
const getPid = {
  type: jsPsychSurveyText,
  questions: [
    {
      prompt: i18next.t('participantID'),
      name: 'pid',
      required: true,
    },
  ],
  button_label: i18next.t('buttonLabel'),
  css_classes: ['jspsych-content-modified'],
  on_finish: (data) => {
    const config = store.session.get('config');
    config.pid = data.response.pid;
    store.session.set('config', config);
  },
};

const ifGetPid = {
  timeline: [getPid],
  conditional_function: () =>
    !store.session.get('config').pid && store.session.get('config').recruitment === 'otherLabs',
};

const consentForm = {
  type: jsPsychSurveyMultiSelect,
  questions: [
    {
      prompt: ` <div>
        <p class=" consent_form_title">STANFORD UNIVERSITY CONSENT FORM</p>
        <p class=" consent_form_text">
        <b>PURPOSE OF THE STUDY</b> 
        <br>
        Data collected through games in the web-browser will help researchers understand relationships between academic skills, reading proficiency, cognition, perception, and/or attitudes towards reading and school in individuals with a broad range of reading skills.
        <br><br>
        <b>STUDY PROCEDURES</b> 
        <br>
        In this study, you will be asked to complete computer tasks via a computer screen. Audio will be presented via headphones or speakers.
        <br><br>
        <b>PRIVACY AND DATA COLLECTION</b> <br>
        We will do our best to ensure your privacy. Data that is collected through this online experiment is stored separately from identifying information such as your name. For the sake of payment, sometimes we store an email address you provide, but this is stored separately from the responses that are recorded in the online experiment. Each participant is assigned a code and that is used rather than names. This is called “coded data” and we try to ensure that the identity of our research participants is kept confidential. Data collected as part of this study may be used for many years to help discover trends in the population and explore changes due to development and education. In addition, coded data may be shared online or with collaborators to allow for new and unforeseen discoveries. Researchers may choose to include coded data in publications to support findings, or they may choose to release coded data alongside findings for replicability.
        <br>
        <br>
        We will collect mouse and click, scores earned, button presses and their timestamps, or other data that may be derived from your behavior on our page. This data will be stored on servers. Incomplete data may be logged if you quit out of the experiment early. If you would like to void your data, you may request it through our contact email. 
        <br>
        <br>
        <b>COMPENSATION</b>
        <br> 
        Participation in this study is voluntary and you will not receive financial compensation.
        <br>
        <br>
        <b>RISKS, STRESS, OR DISCOMFORT</b>
        <br>
        If there is any reason to believe you are not safe to participate in any of the tasks, please contact us at <a href="url">readingresearch@stanford.edu</a>. Some people may experience some physical discomfort or boredom due to being asked to sit for long periods. For computer tasks, some people may also experience dry eyes or eye fatigue. For some tasks that are untimed, breaks can be taken as needed during the session.
        <br>
        <br>
        <b>CONTACT INFORMATION </b>
        <br>
        If you have any additional questions or concerns about our research, feel free to email us at <a href="url">readingresearch@stanford.edu</a>. We will be more than happy to help!
        <br>
        <br>
        For general information regarding questions or concerns about your rights as a research participant, please call 1-866-680-2906 to reach the Administrative Panel on Human Subjects in Medical Research, Stanford University.
        </p>
 </div>
     `,
      options: [
        `<b>I agree to participate in this research. Participation in this research is voluntary, and I can stop at any time without penalty. <br> I feel that I understand what I am getting into, and I know I am free to leave the experiment at any time by simply closing the web browser.
        </b>`,
      ],
      required: true,
      required_message: 'You must check the box to continue',
      name: 'Agree',
    },
  ],
};

// conditional timeline for consent form: will only appear if user mode or task recruitment = demo
const ifConsentForm = {
  timeline: [consentForm],
  conditional_function: () => store.session.get('config').recruitment === 'demo' || store.session.get('config').consent,
};

const surveyPid = {
  type: jsPsychSurveyHtmlForm,
  preamble:
    '<div><h1>Please share a bit more to help us understand your data!</h1>' +
    '<p>This information is optional.</p></div>',
  html: `
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
      <span class = "survey_form_text">Have you taken this game before?</span>
      <select id = "retake" name = "retake" style = "font-size: 2vh">
        <option value=""></option>
        <option value="0">No</option>
        <option value="1">Yes</option>
      </select>
    </div>
    <br>`,
  autocomplete: true,
  on_finish: (data) => {
    const tmpMetadata = {};
    for (const field in data.response) {
      if (data.response[field] === '') {
        tmpMetadata[field] = null;
      } else if (field === 'retake' || field === 'ell') {
        tmpMetadata[field] = parseInt(data.response[field], 10);
      } else {
        tmpMetadata[field] = data.response[field];
      }
    }
    tmpMetadata.grade = store.session.get('config').userMetadata.grade;

    const config = store.session.get('config');
    const ageData = getAgeData(null, null, tmpMetadata.age);
    config.userMetadata = { ...config.userMetadata, ...tmpMetadata, ...ageData };
    store.session.set('config', config);
  },
};

const ifSurvey = {
  timeline: [surveyPid],
  conditional_function: () => store.session.get('config').recruitment === 'demo' || store.session.get('config').consent,
};

/* conditional trial that asks students to press a key to determine TOSREC stimuli
    - grade_select defines the trial and if_grade_select is a conditional
    timeline that will only appear if there is no grade meta_data from the dashboard */

const gradeSelect = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio.gradeSelect,
  prompt: () => {
    if (isMobile) {
      return `
        <div class="mobile-grade-select">
          <h3>${i18next.t('introduction.gradeSelect.text1')}</h3>
          <p>${i18next.t('introduction.gradeSelect.text2Mobile')}</p>
          <p>${i18next.t('introduction.gradeSelect.text3')}</p>
          <div class="button">${i18next.t('introduction.gradeSelect.text4Mobile')}</div>
        </div>`;
    }
    return `
      <div class="jspsych-content-modified" id="sre-background">
        <h3>${i18next.t('introduction.gradeSelect.text1')}</h3>
        <p>${i18next.t('introduction.gradeSelect.text2')}</p>
        <p>${i18next.t('introduction.gradeSelect.text3')}</p>
        <img width="50%" src="${mediaAssets.images.gradeKeyboard}" alt="grade keys">
        <div class="button">${i18next.t('introduction.gradeSelect.text4')}</div>
      </div>`;
  },
  keyboard_choices: isMobile ? 'NO_KEYS' : ['1', '2', '3', '4', '5', '6', '7', '8'],
  button_choices: isMobile ? gradeChoices : [],
  button_html: '<button class="grade-btn">%choice%</button>',
  prompt_above_buttons: true,
  on_load: () => {
    document.body.style.background = 'rgb(250, 246, 236)';
  },
  on_finish: async (data) => {
    document.body.style.background = 'white';

    const response = data.button_response ?? data.keyboard_response;

    if (isMobile) {
      store.session.set('tosrecCorpusId', `tosrec${response + 1}`);
    } else {
      store.session.set('tosrecCorpusId', `tosrec${response}`);
    }

    const config = store.session.get('config');
    config.userMetadata = {
      ...config.userMetadata,
      grade: isMobile ? Number(response + 1) : Number(response),
    };

    config.story = getStoryOption(config.storyOption, config.userMetadata.grade);

    store.session.set('config', config);
  },
};
/*
const validStringGrades = [
  'K',
  'PK',
  'TK',
  'PreKindergarten',
  'TransitionalKindergarten',
  'Kindergarten',
  'InfantToddler',
  'Preschool',
].map((grade) => grade.toLowerCase());

function isGradeValid(grade) {
  // We want a number between 1-12, OR a valid string
  if (
    (grade > 0 && grade <= 12) ||
    ((typeof grade === 'string' || grade instanceof String) && validStringGrades.includes(grade.toLowerCase()))
  ) {
    return true;
  }
  return false;
}

 */
const ifGradeSelect = {
  timeline: [gradeSelect],
  conditional_function: () => {
    const { grade } = store.session.get('config').userMetadata;
    // Check if grade is defined.
    // Note, we use != to compare against both undefined and null.
    // eslint-disable-next-line eqeqeq
    if (getGrade(grade) != undefined) {
      store.session.set('tosrecCorpusId', `tosrec${grade}`);
      return false;
    }
    return true;
  },
};

export const getUserDataTimeline = [ifGetLabId, ifGetPid, ifConsentForm, ifSurvey, ifGradeSelect];
