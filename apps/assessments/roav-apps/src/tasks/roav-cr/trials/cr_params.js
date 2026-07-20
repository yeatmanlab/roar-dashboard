/* eslint-disable no-underscore-dangle */
import '../../../i18n/i18n';
// import jsPsychSurveyHtmlForm from "@jspsych/plugin-survey-html-form";
import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import {
  metaparamsCrDef,
  TypeOrient,
  TypeTask,
  prepareParams,
  htmlStimFix,
  StageTrial,
  mapTaskToInstrResp,
} from './cr_trial';
import { sessionSet } from '../../shared/helpers/sessionHelpers';
import { CR_SESSION_KEYS as SK } from '../helpers/cr_sessionKeys';
import { CR } from '../helpers/cr_constants';
import { SCREEN } from '../../shared/helpers/constants';

const mapTaskToPreset = {
  [TypeTask.SHAPE_IDENT]: {
    showFlankHor: true,
    showFlankVert: true,
    sameFlank: false,
  },
  [TypeTask.SHAPE_COMPARE_REF]: {
    showFlankHor: false,
    showFlankVert: true,
    sameFlank: false,
  },
  [TypeTask.SHAPE_COMPARE_LR]: {
    showFlankHor: false,
    showFlankVert: true,
    sameFlank: false,
  },
  [TypeTask.ORIENT_IDENT]: {
    nameTarg: 'rocket',
    nameFlank: 'cloud',
    // nameTarg: "circle-open",
    // nameFlank: "circle",
    typeOrient: TypeOrient.DIR_4,
    showFlankHor: true,
    showFlankVert: true,
    sameFlank: false,
  },
  [TypeTask.ORIENT_COMPARE_REF]: {
    typeOrient: TypeOrient.DIR_2_ANGLE,
    nameTarg: 'rocket',
    nameFlank: 'cloud',
    showFlankHor: false,
    showFlankVert: true,
    sameFlank: false,
  },
  [TypeTask.ORIENT_COMPARE_LR]: {
    typeOrient: TypeOrient.DIR_2_VERT,
    rot: 90,
    nameTarg: 'rocket-clr',
    nameFlank: 'cloud-clr',
    showFlankHor: true,
    showFlankVert: true,
    sameFlank: false,
  },
};

const getValueById = (id) => document.getElementById(id).value;
const getCheckedById = (id) => document.getElementById(id).checked;

const ECC_MIN = 2;
const ECC_MAX = 8;
const ECC_STEP = 0.25;
const SIZE_STIM_MIN = 0.25;
const SIZE_STIM_MAX = 1.5;
const SIZE_STIM_STEP = 0.25;
const DURATION_FIXATION_MIN = 50;
const DURATION_FIXATION_STEP = 10;
const DURATION_STIM_MIN = 50;
const DURATION_STIM_STEP = 10;

const namesTarg = ['rocket', 'rocket-clr', 'circle-open', 'T'];
const namesFlank = ['cloud', 'cloud-clr', 'circle', 'box'];
const namesStimShape = ['butterfly', 'car', 'tree', 'duck', 'heart', 'rocket'];

const fillMetaparams = () => {
  const metaparams = {
    ...metaparamsCrDef,
    typeTask: getValueById('id-type-task'),
    _eccentTarg: Number(getValueById('id-eccent-targ')),
    _sizeStim: Number(getValueById('id-size-stim')),
    showFlankHor: getCheckedById('id-show-flank-hor'),
    showFlankVert: getCheckedById('id-show-flank-vert'),
    _sameFlank: getCheckedById('id-same-flank'),
    _nameFlank: getCheckedById('id-same-flank') ? getValueById('id-name-flank') : null,
    vdCm: Number(getValueById('id-dist-view-cm')),
    widthScreenCm: Number(getValueById('id-width-screen-cm')),
    durationFix: Number(getValueById('id-duration-fix')),
    durationStim: Number(getValueById('id-duration-stim')),
  };
  if (
    metaparams.typeTask === TypeTask.SHAPE_IDENT ||
    metaparams.typeTask === TypeTask.SHAPE_COMPARE_REF ||
    metaparams.typeTask === TypeTask.SHAPE_COMPARE_LR
  ) {
    metaparams.namesStim = namesStimShape;
  } else if (
    metaparams.typeTask === TypeTask.ORIENT_IDENT ||
    metaparams.typeTask === TypeTask.ORIENT_COMPARE_REF ||
    metaparams.typeTask === TypeTask.ORIENT_COMPARE_LR
  ) {
    const nameTarg = getValueById('id-name-targ');
    const nameFlank = getValueById('id-name-flank');
    metaparams.namesStim = [nameTarg, nameFlank];

    const typeOrient = getValueById('id-type-orient');
    const rot = Number(getValueById('id-angle'));

    metaparams.anglesFlank = [0, 90, 180, 270];
    switch (typeOrient) {
      case TypeOrient.DIR_4:
        metaparams.anglesTarg = [0, 90, 180, 270];
        break;
      case TypeOrient.DIR_2_HOR:
        metaparams.anglesTarg = [90, 270];
        break;
      case TypeOrient.DIR_2_VERT:
        metaparams.anglesTarg = [0, 180];
        break;
      case TypeOrient.DIR_2_ANGLE:
        metaparams.anglesTarg = [-rot, rot];
        break;
      default:
        metaparams.anglesTarg = [0, 90, 180, 270];
        break;
    }
  }
  return metaparams;
};

export const t_crParams = () => {
  let numTrial;
  let metaparams;
  let updatePreview = true;
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <style>
          body, input, select, button, label, h3 { font-family: Arial, sans-serif; }
          .settings-wrap { width: 50svw; margin: 0 auto; }
          label { display: grid; grid-template-columns: 20svw 25svw; gap: 1svw; margin: 1svh 0; text-align: left}
        </style>
        
        <div id="id-text-resp" style="white-space: pre; width: 100vw; border-bottom: 1px solid #ccc; padding-bottom: 10px; font-weight: bold"></div>  
        <div id="id-preview" style="position: relative; width: 100vw; margin-left: calc(-50vw + 50%); height: 20vh; border-bottom: 1px solid #ccc;"></div>
        <div class="settings-wrap">
          
          <div style="height: 6px;"></div>
    
          <label>Screen width (cm):
            <input id="id-width-screen-cm" type="number" value="${SCREEN.WIDTH_CM_DEF}"
              min="${SCREEN.WIDTH_CM_MIN}" max="${SCREEN.WIDTH_CM_MAX}" required>
          </label>

          <label >Viewing distance (cm):
            <input id="id-dist-view-cm" type="number" value="${metaparamsCrDef.vdCm}"
              min="${CR.VD_CM_MIN}" max="${CR.VD_CM_MAX}" required>
          </label>

          <div style="height: 6px;"></div>

          <label style="font-weight: bold; font-size:1.1em">Task Type:
            <select id="id-type-task" style="font-weight: bold; font-size: 1em">
              <option value="${TypeTask.SHAPE_IDENT}" selected>identify shape</option>
              <option value="${TypeTask.SHAPE_COMPARE_REF}">compare shape to reference</option>
              <option value="${TypeTask.SHAPE_COMPARE_LR}">compare left and right shapes</option>
              <option value="${TypeTask.ORIENT_IDENT}">identify orientation</option>
              <option value="${TypeTask.ORIENT_COMPARE_REF}">compare orientation to reference</option>
              <option value="${TypeTask.ORIENT_COMPARE_LR}">compare left and right orientations</option>
            </select>
          </label>

          <div style="height: 6px;"></div>

          <label>Number of trials:
            <input id="id-num-trial" type="number" value="20" required>
          </label>

          <label>Eccentricity (deg):
            <input id="id-eccent-targ" type="number" value="${metaparamsCrDef._eccentTarg}" 
              min="${ECC_MIN}" max="${ECC_MAX}" step="${ECC_STEP}" required>
          </label>

          <label>Stimuli size (deg):
            <input id="id-size-stim" type="number" value="${metaparamsCrDef._sizeStim}" 
              min="${SIZE_STIM_MIN}" max="${SIZE_STIM_MAX}" step="${SIZE_STIM_STEP}" required>
          </label>

          <label>Fixation (ms):
            <input id="id-duration-fix" type="number" value="${metaparamsCrDef.durationFix}" 
              min="${DURATION_FIXATION_MIN}" step="${DURATION_FIXATION_STEP}" required>
          </label>
          
          <label>Stimuli presentation (ms):
            <input id="id-duration-stim" type="number" value="${metaparamsCrDef.durationStim}" 
              min="${DURATION_STIM_MIN}" step="${DURATION_STIM_STEP}" required>
          </label>

          <label id="id-label-same-flank"><b>Same flankers:</b>
            <input id="id-same-flank" type="checkbox" style="justify-self:start" ${
              metaparamsCrDef._sameFlank ? 'checked' : ''
            }>
          </label>
          <label>Horizontal flankers:
            <input id="id-show-flank-hor" type="checkbox" style="justify-self:start" ${
              metaparamsCrDef.showFlankHor ? 'checked' : ''
            }>
          </label>
          <label>Vertical flankers:
            <input id="id-show-flank-vert" type="checkbox" style="justify-self:start" ${
              metaparamsCrDef.showFlankVert ? 'checked' : ''
            }>
          </label>
          
          <div style="height: 10px"></div>
          
          <label id="id-label-type-orient">Orientation mode:
            <select id="id-type-orient">
              <option value="${TypeOrient.DIR_4}" selected>left right up down</option>
              <option value="${TypeOrient.DIR_2_HOR}">left right</option>
              <option value="${TypeOrient.DIR_2_VERT}">up down</option>
              <option value="${TypeOrient.DIR_2_ANGLE}">angle to left & right</option>
            </select>
          </label>

          <label id="id-label-angle">Rotation angle (deg):
            <input id="id-angle" type="number" value="20" min="0" step="1" required>
          </label>

          <label id="id-label-name-targ">Target:
            <select id="id-name-targ">
              ${namesTarg.map((name) => `<option value="${name.toLowerCase()}">${name}</option>`).join('')}
            </select>
          </label>

          <label id="id-label-name-flank">Flanker:
            <select id="id-name-flank">
              ${namesFlank.map((name) => `<option value="${name}">${name}</option>`).join('')}
            </select>
          </label>
        </div>
      `,
    // button_label: "GO",
    choices: ['GO'],
    on_load: () => {
      // document.forms[0].addEventListener("keydown", (e) => {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.dispatchEvent(new Event('change'));
        }
      });

      const elNameTarg = document.getElementById('id-name-targ');
      const elNameFlank = document.getElementById('id-name-flank');
      const elTypeOrient = document.getElementById('id-type-orient');
      const elTextResp = document.getElementById('id-text-resp');

      const applyPreset = () => {
        const typeTask = getValueById('id-type-task');
        const preset = mapTaskToPreset[typeTask];
        if (!preset) return;
        if (preset.nameTarg !== undefined) {
          elNameTarg.value = preset.nameTarg;
        }
        if (preset.nameFlank !== undefined) {
          elNameFlank.value = preset.nameFlank;
        }
        if (preset.typeOrient !== undefined) {
          elTypeOrient.value = preset.typeOrient;
        }
        if (preset.showFlankVert !== undefined) {
          document.getElementById('id-show-flank-vert').checked = preset.showFlankVert;
        }
        if (preset.showFlankHor !== undefined) {
          document.getElementById('id-show-flank-hor').checked = preset.showFlankHor;
        }
        if (preset.sameFlank !== undefined) {
          document.getElementById('id-same-flank').checked = preset.sameFlank;
        }
      };

      const updateEnabled = () => {
        const typeTask = getValueById('id-type-task');
        const typeOrient = getValueById('id-type-orient');

        const isOrient = [TypeTask.ORIENT_COMPARE_REF, TypeTask.ORIENT_COMPARE_LR, TypeTask.ORIENT_IDENT].includes(
          typeTask,
        );
        const isOrientChangeNotAllowed = [TypeTask.ORIENT_IDENT].includes(typeTask);

        const show = (idLabel, visible) => {
          const elLabel = document.getElementById(idLabel);
          if (!elLabel) return;
          elLabel.style.opacity = visible ? '' : '0.3';
          elLabel.querySelectorAll('input, select').forEach((input) => {
            // eslint-disable-next-line no-param-reassign
            input.disabled = !visible;
          });
        };

        show('id-label-type-orient', isOrient && !isOrientChangeNotAllowed);
        show('id-label-angle', isOrient && typeOrient === TypeOrient.DIR_2_ANGLE);
        show('id-label-name-targ', isOrient);
        show('id-label-name-flank', isOrient || getCheckedById('id-same-flank'));
      };

      const updateMetaparamsAndPreview = () => {
        numTrial = Number(getValueById('id-num-trial'));
        metaparams = fillMetaparams();
        if (updatePreview) {
          const params = prepareParams(metaparams);
          const htmlStimFixCur = htmlStimFix(params, {}, StageTrial.PREVIEW);
          document.getElementById('id-preview').innerHTML = htmlStimFixCur;
        }
      };

      const updateTextResp = () => {
        const typeTask = getValueById('id-type-task');
        elTextResp.textContent = `Response: ${mapTaskToInstrResp[typeTask]}`;
      };

      updateTextResp();
      applyPreset();
      updateEnabled();
      updateMetaparamsAndPreview();

      document.getElementById('id-type-task').addEventListener('change', () => {
        updateTextResp();
        applyPreset();
        updateEnabled();
      });

      document.getElementById('id-type-orient').addEventListener('change', updateEnabled);

      document.getElementById('id-same-flank').addEventListener('change', updateEnabled);

      document
        .querySelectorAll("[id^='id-']")
        .forEach((el) => el.addEventListener('change', updateMetaparamsAndPreview));

      // TODO: connect NOT by the TEXT
      document.addEventListener('mousedown', (e) => {
        if (e.target.textContent.trim() === 'GO') updatePreview = false;
      });
    },
    on_finish: () => {
      updatePreview = false;
      sessionSet(SK.CR_METAPARAMS_BLOCK, metaparams);
      sessionSet(SK.NUM_TRIAL, numTrial);
    },
  };
};
