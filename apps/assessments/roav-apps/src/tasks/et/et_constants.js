export const et_TypeModel = {
  NONE: "none",
  AT_CROPS_BBS: "at-crops-bbs",
};

export const ET = {
  VIDEO: {
    WIDTH_REQ: 1920,
    HEIGHT_REQ: 1080,
    FPS_REQ: 60,
    VIDEO_BITS_PER_SECOND_LOW: 4_000_000,
    VIDEO_BITS_PER_SECOND_MEDIUM: 8_000_000,
    VIDEO_BITS_PER_SECOND_HIGH: 12_000_000,
    VIDEO_BITS_PER_SECOND_REQ_DEF: 8_000_000, // @THINK: important - see what quality preserves video but does not enlarge it
  },
  FM: {
    URL_BASE: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4",
    NAME_FILE_SCRIPT: "face_mesh.min.js",
    CONF_DETECT_MIN: 0.5,
    CONF_TRACK_MIN: 0.5,
    TIMEOUT_FM_START: 1000,
    TIMEOUT_FM_DEF: 16,
  },
  HT: {
    DUR_CALIBR: 3000,
  },
  ET: {
    SIZE_IMG_EYE_MODEL: 128,
    TYPE_MODEL_DEF: et_TypeModel.AT_CROPS_BBS,
    TIMEOUT_MODEL_RETRY: 50,
    TIMEOUT_MODEL_DEF: 16,
  },
  VD_DEF: 50,

  SIZE_IRIS_WORLD_DEF: 11.7,
  FL_NORM_DEF: 1,
};

export const CALIBR_ET_DEF = {
  xCoeff: -3.49,
  xIntercept: 45,
  yCoeff: 0,
  yIntercept: 0,
};

export const CALIBR_VD_DEF = {
  vd: ET.VD_DEF,
  flNorm: ET.FL_NORM_DEF,
  flMult: ET.VIDEO.HEIGHT_REQ,
  sizeIris:
    (ET.VIDEO.HEIGHT_REQ * ET.SIZE_IRIS_WORLD_DEF) /
    (10 * ET.VD_DEF * ET.VIDEO.WIDTH_REQ), // 0.01316
};
