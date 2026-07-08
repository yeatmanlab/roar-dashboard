import { camelCase, upperFirst } from 'lodash';
import i18next from 'i18next';
import { sessionGet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';

const prefixKeyAsset = 'key';
const prefixTextAsset = 'text';

export const TAG_REQ_DEF = 'def';

// it is NameModule rather than NameTask, but called name task everywhere
export const NameTask = {
  SHARED: "shared",
  ET: "et",
  MP: "roav-mp",
  RVP: "roav-rvp",
  CR: "roav-cr",
};

export const ModeGame = {
  GAME: 'game',
  STANDARD: 'stand',
  ALL: 'all',
  NONE: 'none',
};

export const ModeSeq = {
  FIXED: 'fixed',
  RANDOM: 'random',
  ALL: 'all',
};

export const ModeInput = {
  TOUCH: 'touch',
  MOUSE: 'mouse',
  KEYBOARD: 'keyboard',
  NONE: 'none',
  ALL: 'all',
};

export const ModeAdaptStim = {
  NONE: 'none',
  ADAPT: 'adapt',
};

export const ModeAdaptBlock = {
  NONE: 'none',
  ADAPT_ACC: 'adaptAcc',
  ADAPT_IRT: 'adaptIrt',
};

export const SubtypeTrial = {
  QUEST: 'quest',
  CONST: 'const',
  CATCH: 'catch',
};

export const AssessmentStage = {
  TEST: 'test',
  PRACTICE: 'practice',
  INSTRUCTION: 'instruction',
  DATA: 'data',
  NONE: 'none',
};

export const TypeKey = {
  ARROW_RIGHT: 'ArrowRight',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_DOWN: 'ArrowDown',
  ARROW_UP: 'ArrowUp',
  DUMMY: 'dummy',
  BUTTON_LEFT: 'BtnLeft',
  BUTTON_RIGHT: 'BtnRight',
  SPACEBAR: ' ',
};

export const TypeSize = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
};

export const composeKeyAsset = (
  tagTrial,
  tagReq,
  descr,
  modeGame,
  nameTask,
) => {
  const modeGameRes = modeGame ?? sessionGet(SK.MODE_GAME);
  const nameTaskRes = nameTask ?? sessionGet(SK.NAME_TASK);
  let keyAsset = camelCase(nameTaskRes);
  keyAsset += upperFirst(camelCase(tagTrial));
  keyAsset += upperFirst(camelCase(tagReq));
  keyAsset += upperFirst(camelCase(descr));
  keyAsset += upperFirst(camelCase(modeGameRes));
  return keyAsset;
};

export const composeKeyText = (tagTrial, tagReq, descr, modeGame, nameTask) => {
  const modeGameRes = modeGame ?? sessionGet(SK.MODE_GAME);
  const nameTaskRes = nameTask ?? sessionGet(SK.NAME_TASK);
  let keyText = `${nameTaskRes}`;
  if (tagTrial) {
    keyText += `.${tagTrial}`;
  }
  if (tagReq) {
    keyText += `.${tagReq}`;
  }
  keyText += `.${modeGameRes}`;
  if (descr) {
    keyText += `.${descr}`;
  }
  return keyText;
};

export const fetchText = (tagTrial, tagReq, descr, modeGame, nameTask) => {
  const keyText = composeKeyText(tagTrial, tagReq, descr, modeGame, nameTask);
  const text = i18next.t(keyText, {
    interpolation: { escapeValue: false }, // to stop < and > from being overriden
    'audio-only': '',
    'text-only': '',
    'pause-short': '',
    'pause-medium': '',
    'pause-long': '',
    'btn-start': "<span class='roav-inline-button'>",
    'btn-end': '</span>',
  });
  return text;
};

export const fillTextKeyValuesDef = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  const objFilled = obj;
  Object.keys(objFilled).forEach((key) => {
    const value = objFilled[key];

    fillTextKeyValuesDef(value);

    if (key.startsWith(prefixKeyAsset) && Array.isArray(value)) {
      objFilled[key] = composeKeyAsset(...value);
    } else if (key.startsWith(prefixTextAsset) && Array.isArray(value)) {
      objFilled[key] = fetchText(...value);
    }
  });
  return objFilled;
};
