import { SESSION_KEYS } from "../shared/helpers/sessionKeys";

export const ET_SESSION_KEYS = {
  ...SESSION_KEYS,
  VIDEO_ENABLE: "videoEnable",
  VIDEO_RECORD: "videoRecord",
  CAMERA_CONFIRMED: "cameraConfirmed",
  VIDEO_ENABLED: "videoEnabled",

  VD_CALIBRATE: "vdCalibrate",

  ET_CALIBRATE: "etCalibrate",
  ET_CALIBRATE_COLLECT: "etCalibrateCollect",
  ET_ENABLE: "etEnable",

  VD_RECORD: "vdRecord",
  ET_RECORD: "etRecord",
  HT_RECORD: "htRecord",

  VD_FEEDBACK: "vdFeedback",
  HT_FEEDBACK: "htFeedback",

  CONFIG_ET: "configEt",

  SHOW_GAZE: "showGaze",
};
