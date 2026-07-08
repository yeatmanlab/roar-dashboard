export const ET = {
  VIDEO: {
    WIDTH_REQ: 1920,
    HEIGHT_REQ: 1080,
    FPS_REQ: 60,
  },
  FM: {
    URL_BASE: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4",
    // URL_BASE: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1657299874",
    NAME_FILE_SCRIPT: "face_mesh.min.js",
    CONF_DETECT_MIN: 0.5,
    CONF_TRACK_MIN: 0.5,
    TIMEOUT_START: 1000,
  },
  HT: {
    DUR_CALIBR: 3000,
  },
  ET: {
    SIZE_IMG_EYE_MODEL: 128,
    TIMEOUT_RETRY_ITERATION: 50,
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
