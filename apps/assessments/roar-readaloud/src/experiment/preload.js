import jsPsychPreload from "@jspsych/plugin-preload";
import { config } from "./config";

// Image files
import star from "./assets/images/star.svg";
import flower from "./assets/images/flower.png";
import advance from "./assets/images/advance.jpeg";

// Audio files
import feedbackCorrect from "./assets/audio/feedbackCorrect.mp3";
import feedbackIncorrect from "./assets/audio/feedbackIncorrect.mp3";

// Video files
// English language versions
import pseudoBlock1En from "./assets/video/en/pseudoBlock1.mp4";
import pseudoEndEn from "./assets/video/en/pseudoEnd.mp4";
import pseudoIntroEn from "./assets/video/en/pseudoIntro.mp4";
import pseudoPost2BlockEn from "./assets/video/en/pseudoPost2Block.mp4";
import pseudoPostPracticeEn from "./assets/video/en/pseudoPostPractice.mp4";
import pseudoRewardAnimation1En from "./assets/video/en/pseudoRewardAnimation1.mp4";
import pseudoRewardAnimation2En from "./assets/video/en/pseudoRewardAnimation2.mp4";
import latinBlock1En from "./assets/video/en/latinBlock1.mp4";
import latinEndEn from "./assets/video/en/latinEnd.mp4";
import latinIntroEn from "./assets/video/en/latinIntro.mp4";
import latinPost2BlockEn from "./assets/video/en/latinPost2Block.mp4";
import latinPostPracticeEn from "./assets/video/en/latinPostPractice.mp4";
import latinRewardAnimation1En from "./assets/video/en/latinRewardAnimation1.mp4";
import latinRewardAnimation2En from "./assets/video/en/latinRewardAnimation2.mp4";
// Spanish language versions
import pseudoBlock1Es from "./assets/video/es/pseudoBlock1Es.mp4";
import pseudoEndEs from "./assets/video/es/pseudoEndEs.mp4";
import pseudoIntroEs from "./assets/video/es/pseudoIntroEs.mp4";
import pseudoPost2BlockEs from "./assets/video/es/pseudoPost2BlockEs.mp4";
import pseudoPostPracticeEs from "./assets/video/es/pseudoPostPracticeEs.mp4";
import pseudoRewardAnimation1Es from "./assets/video/es/pseudoRewardAnimation1Es.mp4";
import pseudoRewardAnimation2Es from "./assets/video/es/pseudoRewardAnimation2Es.mp4";
import latinBlock1Es from "./assets/video/es/latinBlock1Es.mp4";
import latinEndEs from "./assets/video/es/latinEndEs.mp4";
import latinIntroEs from "./assets/video/es/latinIntroEs.mp4";
import latinPost2BlockEs from "./assets/video/es/latinPost2BlockEs.mp4";
import latinPostPracticeEs from "./assets/video/es/latinPostPracticeEs.mp4";
import latinRewardAnimation1Es from "./assets/video/es/latinRewardAnimation1Es.mp4";
import latinRewardAnimation2Es from "./assets/video/es/latinRewardAnimation2Es.mp4";
// Precue versions
import preCueIntro from "./assets/video/en/precue/intro.mp4";
import preCuePostPractice from "./assets/video/en/precue/postPractice.mp4";
import preCueMidBlock1 from "./assets/video/en/precue/midBlock1.mp4";
import preCueMidBlock2 from "./assets/video/en/precue/midBlock2.mp4";
import preCueMidBlock3 from "./assets/video/en/precue/midBlock3.mp4";
import preCueMidBlock4 from "./assets/video/en/precue/midBlock4.mp4";
import preCueMidBlock5 from "./assets/video/en/precue/midBlock5.mp4";
import preCuePostBlock1 from "./assets/video/en/precue/postBlock1.mp4";
import preCuePostBlock2 from "./assets/video/en/precue/postBlock2.mp4";
import preCuePostBlock3 from "./assets/video/en/precue/postBlock3.mp4";
import preCuePostBlock4 from "./assets/video/en/precue/postBlock4.mp4";
import preCueEnd from "./assets/video/en/precue/end.mp4";
// Generic visual attention versions (dots only)
// If you rename or add video assets, be sure to import them in the lines below
import genericIntro1 from "./assets/video/en/generic/intro1Generic.mp4";
import genericIntro2 from "./assets/video/en/generic/intro2Generic.mp4";
import genericIntro3 from "./assets/video/en/generic/intro3Generic.mp4";
import genericIntro4 from "./assets/video/en/generic/intro4Generic.mp4";
import genericPostPractice from "./assets/video/en/generic/postPracticeGeneric.mp4";
import genericPostBlock1 from "./assets/video/en/generic/postBlock1Generic.mp4";
import genericPostBlock2 from "./assets/video/en/generic/postBlock2Generic.mp4";
import genericPostBlock3 from "./assets/video/en/generic/postBlock3Generic.mp4";
import genericPostBlock4 from "./assets/video/en/generic/postBlock4Generic.mp4";
import genericEnd from "./assets/video/en/generic/endGeneric.mp4";
// Spanish language versions
import genericIntro1Es from "./assets/video/es/generic/intro1GenericEs.mp4";
import genericIntro2Es from "./assets/video/es/generic/intro2GenericEs.mp4";
import genericIntro3Es from "./assets/video/es/generic/intro3GenericEs.mp4";
import genericIntro4Es from "./assets/video/es/generic/intro4GenericEs.mp4";
import genericPostPracticeEs from "./assets/video/es/generic/postPracticeGenericEs.mp4";
import genericPostBlock1Es from "./assets/video/es/generic/postBlock1GenericEs.mp4";
import genericPostBlock2Es from "./assets/video/es/generic/postBlock2GenericEs.mp4";
import genericPostBlock3Es from "./assets/video/es/generic/postBlock3GenericEs.mp4";
import genericPostBlock4Es from "./assets/video/es/generic/postBlock4GenericEs.mp4";
import genericEndEs from "./assets/video/es/generic/endGenericEs.mp4";

function importAll(r) {
  const assets = {};
  r.keys().forEach((asset) => {
    assets[asset.replace("./", "")] = r(asset).default || r(asset);
  });
  return assets;
}

import brokenbar from "./assets/svg/brokenbar.svg";
import cent from "./assets/svg/cent.svg";
import circle from "./assets/svg/circle.svg";
import currency from "./assets/svg/currency.svg";
import dieresis from "./assets/svg/dieresis.svg";
import invertedExclamation from "./assets/svg/invertedExclamation.svg";
import latinCapitalA from "./assets/svg/latinCapitalA.svg";
import latinCapitalAAcute from "./assets/svg/latinCapitalAAcute.svg";
import latinCapitalACircumflex from "./assets/svg/latinCapitalACircumflex.svg";
import latinCapitalADieresis from "./assets/svg/latinCapitalADieresis.svg";
import latinCapitalARing from "./assets/svg/latinCapitalARing.svg";
import latinCapitalATilde from "./assets/svg/latinCapitalATilde.svg";
import latinCapitalAe from "./assets/svg/latinCapitalAe.svg";
import latinCapitalB from "./assets/svg/latinCapitalB.svg";
import latinCapitalCCedilla from "./assets/svg/latinCapitalC-cedilla.svg";
import latinCapitalC from "./assets/svg/latinCapitalC.svg";
import latinCapitalD from "./assets/svg/latinCapitalD.svg";
import latinCapitalE from "./assets/svg/latinCapitalE.svg";
import latinCapitalEAcute from "./assets/svg/latinCapitalEAcute.svg";
import latinCapitalECircumflex from "./assets/svg/latinCapitalECircumflex.svg";
import latinCapitalEDieresis from "./assets/svg/latinCapitalEDieresis.svg";
import latinCapitalEGrave from "./assets/svg/latinCapitalEGrave.svg";
import latinCapitalEth from "./assets/svg/latinCapitalEth.svg";
import latinCapitalF from "./assets/svg/latinCapitalF.svg";
import latinCapitalG from "./assets/svg/latinCapitalG.svg";
import latinCapitalH from "./assets/svg/latinCapitalH.svg";
import latinCapitalI from "./assets/svg/latinCapitalI.svg";
import latinCapitalIAcute from "./assets/svg/latinCapitalIAcute.svg";
import latinCapitalICircumflex from "./assets/svg/latinCapitalICircumflex.svg";
import latinCapitalIDieresis from "./assets/svg/latinCapitalIDieresis.svg";
import latinCapitalIGrave from "./assets/svg/latinCapitalIGrave.svg";
import latinCapitalJ from "./assets/svg/latinCapitalJ.svg";
import latinCapitalK from "./assets/svg/latinCapitalK.svg";
import latinCapitalL from "./assets/svg/latinCapitalL.svg";
import latinCapitalM from "./assets/svg/latinCapitalM.svg";
import latinCapitalN from "./assets/svg/latinCapitalN.svg";
import latinCapitalNTilde from "./assets/svg/latinCapitalNTilde.svg";
import latinCapitalO from "./assets/svg/latinCapitalO.svg";
import latinCapitalOAcute from "./assets/svg/latinCapitalOAcute.svg";
import latinCapitalOCircumflex from "./assets/svg/latinCapitalOCircumflex.svg";
import latinCapitalODieresis from "./assets/svg/latinCapitalODieresis.svg";
import latinCapitalOGrave from "./assets/svg/latinCapitalOGrave.svg";
import latinCapitalOSlash from "./assets/svg/latinCapitalOSlash.svg";
import latinCapitalOTilde from "./assets/svg/latinCapitalOTilde.svg";
import latinCapitalP from "./assets/svg/latinCapitalP.svg";
import latinCapitalQ from "./assets/svg/latinCapitalQ.svg";
import latinCapitalR from "./assets/svg/latinCapitalR.svg";
import latinCapitalS from "./assets/svg/latinCapitalS.svg";
import latinCapitalT from "./assets/svg/latinCapitalT.svg";
import latinCapitalU from "./assets/svg/latinCapitalU.svg";
import latinCapitalUAcute from "./assets/svg/latinCapitalUAcute.svg";
import latinCapitalUGrave from "./assets/svg/latinCapitalUGrave.svg";
import latinCapitalV from "./assets/svg/latinCapitalV.svg";
import latinCapitalW from "./assets/svg/latinCapitalW.svg";
import latinCapitalX from "./assets/svg/latinCapitalX.svg";
import latinCapitalY from "./assets/svg/latinCapitalY.svg";
import latinCapitalZ from "./assets/svg/latinCapitalZ.svg";
import latinSmallA from "./assets/svg/latinSmallA.svg";
import latinSmallB from "./assets/svg/latinSmallB.svg";
import latinSmallC from "./assets/svg/latinSmallC.svg";
import latinSmallD from "./assets/svg/latinSmallD.svg";
import latinSmallE from "./assets/svg/latinSmallE.svg";
import latinSmallF from "./assets/svg/latinSmallF.svg";
import latinSmallG from "./assets/svg/latinSmallG.svg";
import latinSmallH from "./assets/svg/latinSmallH.svg";
import latinSmallI from "./assets/svg/latinSmallI.svg";
import latinSmallJ from "./assets/svg/latinSmallJ.svg";
import latinSmallK from "./assets/svg/latinSmallK.svg";
import latinSmallL from "./assets/svg/latinSmallL.svg";
import latinSmallM from "./assets/svg/latinSmallM.svg";
import latinSmallN from "./assets/svg/latinSmallN.svg";
import latinSmallO from "./assets/svg/latinSmallO.svg";
import latinSmallP from "./assets/svg/latinSmallP.svg";
import latinSmallQ from "./assets/svg/latinSmallQ.svg";
import latinSmallR from "./assets/svg/latinSmallR.svg";
import latinSmallS from "./assets/svg/latinSmallS.svg";
import latinSmallT from "./assets/svg/latinSmallT.svg";
import latinSmallU from "./assets/svg/latinSmallU.svg";
import latinSmallV from "./assets/svg/latinSmallV.svg";
import latinSmallW from "./assets/svg/latinSmallW.svg";
import latinSmallX from "./assets/svg/latinSmallX.svg";
import latinSmallY from "./assets/svg/latinSmallY.svg";
import latinSmallZ from "./assets/svg/latinSmallZ.svg";
import left from "./assets/svg/left.svg";
import multiply from "./assets/svg/multiply.svg";
import plus from "./assets/svg/plus.svg";
import right from "./assets/svg/right.svg";
import section from "./assets/svg/section.svg";
import sterling from "./assets/svg/sterling.svg";
import white from "./assets/svg/white.svg";
import yen from "./assets/svg/yen.svg";

// Character svg images

export const characters = {
  "brokenbar.svg": brokenbar,
  "cent.svg": cent,
  "circle.svg": circle,
  "currency.svg": currency,
  "dieresis.svg": dieresis,
  "invertedExclamation.svg": invertedExclamation,
  "latinCapitalA.svg": latinCapitalA,
  "latinCapitalAAcute.svg": latinCapitalAAcute,
  "latinCapitalACircumflex.svg": latinCapitalACircumflex,
  "latinCapitalADieresis.svg": latinCapitalADieresis,
  "latinCapitalARing.svg": latinCapitalARing,
  "latinCapitalATilde.svg": latinCapitalATilde,
  "latinCapitalAe.svg": latinCapitalAe,
  "latinCapitalB.svg": latinCapitalB,
  "latinCapitalC-cedilla.svg": latinCapitalCCedilla,
  "latinCapitalC.svg": latinCapitalC,
  "latinCapitalD.svg": latinCapitalD,
  "latinCapitalE.svg": latinCapitalE,
  "latinCapitalEAcute.svg": latinCapitalEAcute,
  "latinCapitalECircumflex.svg": latinCapitalECircumflex,
  "latinCapitalEDieresis.svg": latinCapitalEDieresis,
  "latinCapitalEGrave.svg": latinCapitalEGrave,
  "latinCapitalEth.svg": latinCapitalEth,
  "latinCapitalF.svg": latinCapitalF,
  "latinCapitalG.svg": latinCapitalG,
  "latinCapitalH.svg": latinCapitalH,
  "latinCapitalI.svg": latinCapitalI,
  "latinCapitalIAcute.svg": latinCapitalIAcute,
  "latinCapitalICircumflex.svg": latinCapitalICircumflex,
  "latinCapitalIDieresis.svg": latinCapitalIDieresis,
  "latinCapitalIGrave.svg": latinCapitalIGrave,
  "latinCapitalJ.svg": latinCapitalJ,
  "latinCapitalK.svg": latinCapitalK,
  "latinCapitalL.svg": latinCapitalL,
  "latinCapitalM.svg": latinCapitalM,
  "latinCapitalN.svg": latinCapitalN,
  "latinCapitalNTilde.svg": latinCapitalNTilde,
  "latinCapitalO.svg": latinCapitalO,
  "latinCapitalOAcute.svg": latinCapitalOAcute,
  "latinCapitalOCircumflex.svg": latinCapitalOCircumflex,
  "latinCapitalODieresis.svg": latinCapitalODieresis,
  "latinCapitalOGrave.svg": latinCapitalOGrave,
  "latinCapitalOSlash.svg": latinCapitalOSlash,
  "latinCapitalOTilde.svg": latinCapitalOTilde,
  "latinCapitalP.svg": latinCapitalP,
  "latinCapitalQ.svg": latinCapitalQ,
  "latinCapitalR.svg": latinCapitalR,
  "latinCapitalS.svg": latinCapitalS,
  "latinCapitalT.svg": latinCapitalT,
  "latinCapitalU.svg": latinCapitalU,
  "latinCapitalUAcute.svg": latinCapitalUAcute,
  "latinCapitalUGrave.svg": latinCapitalUGrave,
  "latinCapitalV.svg": latinCapitalV,
  "latinCapitalW.svg": latinCapitalW,
  "latinCapitalX.svg": latinCapitalX,
  "latinCapitalY.svg": latinCapitalY,
  "latinCapitalZ.svg": latinCapitalZ,
  "latinSmallA.svg": latinSmallA,
  "latinSmallB.svg": latinSmallB,
  "latinSmallC.svg": latinSmallC,
  "latinSmallD.svg": latinSmallD,
  "latinSmallE.svg": latinSmallE,
  "latinSmallF.svg": latinSmallF,
  "latinSmallG.svg": latinSmallG,
  "latinSmallH.svg": latinSmallH,
  "latinSmallI.svg": latinSmallI,
  "latinSmallJ.svg": latinSmallJ,
  "latinSmallK.svg": latinSmallK,
  "latinSmallL.svg": latinSmallL,
  "latinSmallM.svg": latinSmallM,
  "latinSmallN.svg": latinSmallN,
  "latinSmallO.svg": latinSmallO,
  "latinSmallP.svg": latinSmallP,
  "latinSmallQ.svg": latinSmallQ,
  "latinSmallR.svg": latinSmallR,
  "latinSmallS.svg": latinSmallS,
  "latinSmallT.svg": latinSmallT,
  "latinSmallU.svg": latinSmallU,
  "latinSmallV.svg": latinSmallV,
  "latinSmallW.svg": latinSmallW,
  "latinSmallX.svg": latinSmallX,
  "latinSmallY.svg": latinSmallY,
  "latinSmallZ.svg": latinSmallZ,
  "left.svg": left,
  "multiply.svg": multiply,
  "plus.svg": plus,
  "right.svg": right,
  "section.svg": section,
  "sterling.svg": sterling,
  "white.svg": white,
  "yen.svg": yen,
};

export const camelCase = (inString) =>
  inString.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const preloadObj2contentObj = (preloadObj) => {
  const contentArray = [].concat(...Object.values(preloadObj));
  return contentArray.reduce((o, val) => {
    const pathSplit = val.split("/");
    const fileName = pathSplit[pathSplit.length - 1];
    const key = fileName.split(".")[0].replace(/Es$/, "");
    // eslint-disable-next-line no-param-reassign
    o[camelCase(key)] = val;
    return o;
  }, {});
};

const preload_character_trials = {
  type: jsPsychPreload,
  images: Object.values(characters),
  auto_preload: false,
  message: "0 Please wait while the experiment loads.",
  show_progress_bar: true,
  show_detailed_errors: true,
};

let videoBlocks;
if (config.language === "en") {
  if (config.dots) {
    // Any video assets that were imported above should also be
    // included in the array below, by referencing the variable name that you
    // used in the import statement.
    videoBlocks = {
      1: [
        genericIntro1,
        genericIntro2,
        genericIntro3,
        genericIntro4,
        genericPostPractice,
        genericPostBlock1,
        genericPostBlock2,
        genericPostBlock3,
        genericPostBlock4,
        genericEnd,
      ],
    };
  } else if (config.precue) {
    videoBlocks = {
      1: [
        preCueIntro,
        preCuePostPractice,
        preCueMidBlock1,
        preCueMidBlock2,
        preCueMidBlock3,
        preCueMidBlock4,
        preCueMidBlock5,
        preCuePostBlock1,
        preCuePostBlock2,
        preCuePostBlock3,
        preCuePostBlock4,
        preCueEnd,
      ],
    };
  } else if (config.pseudoFont) {
    videoBlocks = {
      1: [
        pseudoBlock1En,
        pseudoEndEn,
        pseudoIntroEn,
        pseudoPost2BlockEn,
        pseudoPostPracticeEn,
        pseudoRewardAnimation1En,
        pseudoRewardAnimation2En,
      ],
    };
  } else {
    videoBlocks = {
      1: [
        latinBlock1En,
        latinEndEn,
        latinIntroEn,
        latinPost2BlockEn,
        latinPostPracticeEn,
        latinRewardAnimation1En,
        latinRewardAnimation2En,
      ],
    };
  }
} else {
  // eslint-disable-next-line no-lonely-if
  if (config.dots) {
    videoBlocks = {
      1: [
        genericIntro1Es,
        genericIntro2Es,
        genericIntro3Es,
        genericIntro4Es,
        genericPostPracticeEs,
        genericPostBlock1Es,
        genericPostBlock2Es,
        genericPostBlock3Es,
        genericPostBlock4Es,
        genericEndEs,
      ],
    };
  } else if (config.pseudoFont) {
    videoBlocks = {
      1: [
        pseudoBlock1Es,
        pseudoEndEs,
        pseudoIntroEs,
        pseudoPost2BlockEs,
        pseudoPostPracticeEs,
        pseudoRewardAnimation1Es,
        pseudoRewardAnimation2Es,
      ],
    };
  } else {
    videoBlocks = {
      1: [
        latinBlock1Es,
        latinEndEs,
        latinIntroEs,
        latinPost2BlockEs,
        latinPostPracticeEs,
        latinRewardAnimation1Es,
        latinRewardAnimation2Es,
      ],
    };
  }
}

const imageBlocks = {
  2: [star, advance, flower],
};

const audioBlocks = {
  3: [feedbackCorrect, feedbackIncorrect],
};

// Automatically populate the audioContent object with the audio files
export const imgContent = preloadObj2contentObj(imageBlocks);
export const videoContent = preloadObj2contentObj(videoBlocks);
export const audioContent = preloadObj2contentObj(audioBlocks);

const preload_video_trials = Object.entries(videoBlocks).map(
  ([idx, img_block]) => ({
    type: jsPsychPreload,
    video: img_block,
    auto_preload: false,
    message: `${idx} Please wait while the experiment loads. This may take a few minutes.`,
    show_progress_bar: true,
    show_detailed_errors: true,
  }),
);

const preload_img_trials = Object.entries(imageBlocks).map(
  ([idx, img_block]) => ({
    type: jsPsychPreload,
    images: img_block,
    auto_preload: false,
    message: `${idx} Please wait while the experiment loads. This may take a few minutes.`,
    show_progress_bar: true,
    show_detailed_errors: true,
  }),
);

const preload_audio_trials = Object.entries(audioBlocks).map(
  ([idx, audio_block]) => ({
    type: jsPsychPreload,
    audio: audio_block,
    auto_preload: false,
    message: `${idx} Please wait while the experiment loads. This may take a few minutes.`,
    show_progress_bar: true,
    show_detailed_errors: true,
  }),
);

export const preload_trials = [
  preload_character_trials,
  ...preload_video_trials,
  ...preload_img_trials,
  ...preload_audio_trials,
];
