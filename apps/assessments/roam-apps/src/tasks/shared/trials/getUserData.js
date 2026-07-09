/*
Defines forms for getting consent, lab id, pid, and survey.
*/

import jsPsychSurveyText from "@jspsych/plugin-survey-text"; //questions with free response text fields
import jsPsychSurveyHtmlForm from "@jspsych/plugin-survey-html-form"; //set of inputs
import jsPsychSurveyMultiSelect from "@jspsych/plugin-survey-multi-select"; //questions with multiple select response fields
import store from "store2"; //storing session data
import { getAgeData } from "@bdelab/roar-utils";

//enter lab id in a textbox
const getLabId = {
  type: jsPsychSurveyText,
  questions: [
    {
      prompt: "Lab ID:",
      name: "labId",
      required: true,
    },
  ],
  on_load: () => {
    document.getElementById("input-0").style.fontSize = "3vh";
  },
  on_finish: (data) => {
    const config = store.session.get("config");
    config.labId = data.response.labId;
    store.session.set("config", config); //can find config definition in config.js, this is stored as session data
  },
};

//get the lab id only if it is null (if it is undefined then we don't ask for it)
const ifGetLabId = {
  timeline: [getLabId],
  conditional_function: () =>
    !store.session.get("config").labId &&
    store.session.get("config").recruitment === "otherLabs",
};

//get the pid in a textbox
const getPid = {
  type: jsPsychSurveyText,
  questions: [
    {
      prompt: "Participant ID:",
      name: "pid",
      required: true,
    },
  ],
  on_load: () => {
    document.getElementById("input-0").style.fontSize = "3vh";
  },
  on_finish: (data) => {
    let config = store.session.get("config");
    config.pid = data.response.pid;
    store.session.set("config", config);
  },
};

//get the pid only if it is null (if it is undefined then we don't ask for it)
const ifGetPid = {
  timeline: [getPid],
  conditional_function: () =>
    !store.session.get("config").pid &&
    store.session.get("config").recruitment === "otherLabs",
};

// //defines the consent form
const consent_form = {
  type: jsPsychSurveyMultiSelect,
  questions: [
    {
      prompt: `<div class="scrollable-consent-form">
          <table class="consent-form-table">
          <tr>
            <td colspan="2"><b>STANFORD UNIVERSITY Research Consent Form</b></td>
            <td rowspan="2" class="dashed-border">
            <span class="center-text red-text">IRB Use Only</span>
            Approval Date: February 24, 2025<br>
            Expiration Date: August 31, 2025
            </td>
          </tr>
          <tr>
            <td colspan="2">Protocol Director:	Jason D. Yeatman, PhD</td>
          </tr>
          <tr>
            <td colspan="3">Protocol Title:   Rapid Online Assessment of Reading </td>
          </tr>
          </table>
          <br><br>
          <div class="consent-form-title">STANFORD UNIVERSITY CONSENT FORM
          <br>
          Stanford University Reading & Dyslexia Research Program: Behavioral Testing
          </div>
          <br>
          <div class="consent-form-text">

          <table>
          <tr>
            <td><b>Principal Investigator:</b></td>
            <td>Jason D. Yeatman, Associate Professor<br>
            Graduate School of Education<br>
            School of Medicine, Division of Developmental Behavioral Pediatrics</td>
          </tr>
          </table>
          
          <br><br>

          <table>
          <tr>
            <td><b>Contact:</b></td>
            <td>roar-research@stanford.edu
              <br>
              https://roar.stanford.edu/
              <br>
              https://dyslexia.stanford.edu/
            </td>
          </tr>
          </table>
          <br><br>
          <b>PURPOSE OF THE STUDY</b> 
          <br>
          Data collected through games in the web-browser will help researchers understand relationships between academic skills, reading and math proficiency, cognition, perception, and/or attitudes towards academic skills and school in individuals with a broad range of skills. Your participation supports the development and validation of efficient online assessment tools that fit the needs of all educators, medical providers, and researchers. Any future research that is published from this study can be found on our website: roar.stanford.edu.
          <br><br>
          <b>STUDY PROCEDURES</b> 
          <br>
          In this study, you will be asked to: 
          
          <ul>
            <li>Complete computer tasks via a computer screen in which audio will be presented via headphones or speakers. They will look at things, such as but not limited to words, sentences, numbers, geometric shapes, mathematical symbols and operators, or cartoon pictures, and respond by clicking, typing, tapping, or speaking depending on the task. These responses will be recorded.</li>
            <li>Answer questions about their feelings about reading, learning, school, and the activities they played.</li>
          </ul>
          
          You may be asked to complete multiple tasks in one session. 
          <br><br>
          <b>TIME INVOLVEMENT</b> 
          <br>
          Your participation will take approximately 1 hour. 
          <br><br>
          <b>PRIVACY AND DATA COLLECTION</b> <br>
          We will do our best to ensure your privacy. Data that is collected through this online experiment is stored separately from identifying information such as your name, but information that is required for analysis such as birth year, birth month, and grade will be stored alongside data. Each participant is assigned a code and that is used rather than names. This is called "coded data" and we try to ensure that the identity of our research participants is kept confidential. Data collected as part of this study may be used for many years to help discover trends in the population and explore changes due to development and education. In addition, coded data may be shared online or with collaborators to allow for new and unforeseen discoveries. Researchers may choose to include coded data in publications to support findings, or they may choose to release coded data alongside findings for replicability.
          <br>
          <br>
          We will collect questionnaire responses, mouse and click data, keyboard response data, scrolling behavior, scores earned, button presses and their timestamps, time spent on each page, IP address to look up state and county, audio recordings, or other data that may be derived from your behavior on our page. This data will be stored on protected servers. Incomplete data may be logged if you quit out of the experiment early. If you would like to void your data, you may request it through our contact email.
          <br>
          <br>
          <b>FUTURE USE OF PRIVATE INFORMATION</b> <br>
          Research using private information is an important part of ensuring our assessments and tools are valid for people of all backgrounds. You are being given this information because the investigators want to save private information for future research.
          <br>
          <br>
          Identifiers might be removed from identifiable private information and, after such removal, the information could be used for future research studies or distributed to another investigator for future research studies without additional informed consent from you.
          <br>
          <br>
          <b>COMPENSATION</b>
          <br> 
          We value your participation. You will receive a calculated rate of $14/hour and be appropriately compensated depending on the length of the study. This is in accordance with the payment principles of Prolific. Through Prolific, participants can only receive a monetary award and not any other forms of payment.
          <br>
          <br>
          <b>RISKS AND BENEFITS</b>
          <br>
          The benefit is that you can help researchers learn about the development of academic skills. We cannot and do not guarantee or promise that you will receive any benefits from this study.
          <br>
          <br>
          If there is any reason to believe you are not safe to participate in any of the tasks, please contact us at roar-research@stanford.edu. Some people may experience some physical discomfort or boredom due to being asked to sit for long periods. For computer tasks, some people may also experience dry eyes or eye fatigue. For tasks that are untimed, breaks can be taken as needed during the session.
          <br>
          <br>
          <b>FINANCIAL SPONSOR</b>
          <br>
          Stanford University, the State of California, the Jacobs Foundation, Microsoft, Georgia State University (GSU) and the Advanced Education Research and Development Fund (AERDF) are providing financial support and/or material for this study.
          <br>
          <br>
          <b>PARTICIPANT'S RIGHTS</b>
          <br>
          If you have read this form and have decided to participate in this project, please understand your participation is voluntary and you have the right to withdraw your consent or discontinue participation at any time without penalty.  The alternative is not to participate. You have the right to refuse to answer particular questions. The results of this research study may be presented at scientific or professional meetings or published in scientific journals. Your individual privacy will be maintained in all published and written data resulting from the study.
          <br>
          <br>
          <b>CONTACT INFORMATION </b>
          <br>
          If you have any additional questions or concerns about our research, feel free to email us at roar-research@stanford.edu. We will be more than happy to help! If you have any questions, concerns or complaints about this research, its procedures, risks and benefits, contact the Protocol Director, Jason Yeatman at jyeatman@stanford.edu. You should also contact us at any time if you feel you have been hurt by being a part of this study.
          <br>
          <br>
          <u>Independent Contact:</u> If you are not satisfied with how this study is being conducted, or if you have any concerns, complaints, or general questions about the research or your rights as a participant, please contact the Stanford Institutional Review Board (IRB) to speak to someone independent of the research team at 650-723-5244 or toll free at 1-866-680-2906.  You can also write to the Stanford IRB, Stanford University, 1705 El Camino Real, Palo Alto, CA 94306. 
          <br><br>
          Please print a copy of this consent form for your records. 
          <br><br>
          Agreement obtained through checkbox/key press/mouse click. 
          </div>
      </div>
      `,
      options: [
        `<b>I agree to participate in this research. Participation in this research is voluntary, and I can stop at any time without penalty. I feel that I understand what I am getting into, and I know I am free to discontinue the experiment with no consequence to myself and/or my child.</b>`,
      ],
      required: true,
      required_message: "You must check the box to continue",
      name: "Agree",
    },
  ],
};

//shows the consent form if the conditions are met (userMode is hardcoded as testRandom in config.js which means that taskVariant has to be provided somewhere)
//consent is true unless intialised as false
const ifConsentForm = {
  timeline: [consent_form],
  conditional_function: () =>
    Boolean(
      (store.session.get("config").recruitment === "otherLabs" ||
        store.session.get("config").recruitment === "prolific") &&
        store.session.get("config").consent,
    ),
};

//defines syrvey form, assigns user meta data which till now is undefined (as per config.js)
/* demo survey */
const survey_pid = {
  type: jsPsychSurveyHtmlForm,
  preamble: () =>
    `<div><h1>Please share a bit more to help us understand your data!</h1>
    <p class="intro-text">[Optional]</p></div>`,
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
    Object.keys(data.response).forEach((field) => {
      if (data.response[field] === "") {
        tmpMetadata[field] = null;
      } else if (field === "retake" || field === "ell") {
        tmpMetadata[field] = parseInt(data.response[field], 10);
      } else {
        tmpMetadata[field] = data.response[field];
      }
    });
    tmpMetadata.labId = store.session.get("config").labId;

    const config = store.session.get("config");
    const ageData = getAgeData(null, null, tmpMetadata.age);
    config.userMetadata = {
      ...config.userMetadata,
      ...tmpMetadata,
      ...ageData,
    };
    store.session.set("config", config);
  },
};

//shows survey if the conditions, which are same as consent form, are met
const ifGetSurvey = {
  timeline: [survey_pid],
  conditional_function: () =>
    Boolean(
      (store.session.get("config").recruitment === "otherLabs" ||
        store.session.get("config").recruitment === "prolific") &&
        store.session.get("config").consent &&
        store.session.get("config").taskName !== "response-modality-study",
    ),
};

//timeline for getting information from user
export const getUserDataTimeline = [
  ifGetLabId,
  ifGetPid,
  ifConsentForm,
  ifGetSurvey,
];
