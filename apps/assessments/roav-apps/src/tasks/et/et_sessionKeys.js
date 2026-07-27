import { SESSION_KEYS } from '../shared/helpers/sessionKeys';

export const ET_SESSION_KEYS = {
  ...SESSION_KEYS,
  VIDEO_ENABLE: 'videoEnable',
  VIDEO_ENABLED: 'videoEnabled',
  VIDEO_RECORD: 'videoRecord',

  // VD_CALIBR: "vdCalibr",
  // LEN_FOCAL_NORM_CALIBR: "flNormCalibr",
  // LEN_FOCAL_MULT_CALIBR: "flMult",
  // SIZE_IRIS_CALIBR: "sizeIrisCalibr",

  VD_CALIBRATE: 'vdCalibrate',
  // VD_CALIBRATED: "calibratedVd",

  ET_CALIBRATE: 'etCalibrate',
  ET_ENABLE: 'etEnable',
  // ET_CALIBRATED: "calibratedEt",

  VD_RECORD: 'vdRecord',
  ET_RECORD: 'etRecord',
  HT_RECORD: 'htRecord',

  VD_FEEDBACK: 'vdFeedback',
  HT_FEEDBACK: 'htFeedback',

  CONFIG_ET: 'configEt',
};
