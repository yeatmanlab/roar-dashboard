import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const devFirebaseConfig = {
  admin: {
    apiKey: 'AIzaSyCl-JsYraUfofQZXpzshQ6s-E0nYzlCvvg',
    authDomain: 'gse-roar-admin-dev.firebaseapp.com',
    projectId: 'gse-roar-admin-dev',
    storageBucket: 'gse-roar-admin-dev.appspot.com',
    messagingSenderId: '401455396681',
    appId: '1:401455396681:web:859ea073a116d0aececc98',
  },
  assessment: {
    apiKey: 'AIzaSyCEUxEgYMp4fg2zORT0lsgn4Q6CCoMVzjU',
    authDomain: 'gse-roar-assessment-dev.firebaseapp.com',
    projectId: 'gse-roar-assessment-dev',
    storageBucket: 'gse-roar-assessment-dev.appspot.com',
    messagingSenderId: '26086061121',
    appId: '1:26086061121:web:262163d6c145b7a80bc2c0',
  },
};

const initializeAndGetFirebase = (config, name) => {
  const app = initializeApp(config, name);
  const db = getFirestore(app);
  return {
    // Change this to app
    auth: app,
    db: db,
  };
};

const getAdminDevFirebase = () => initializeAndGetFirebase(devFirebaseConfig.admin, 'admin');

const getAssessmentDevFirebase = () => initializeAndGetFirebase(devFirebaseConfig.assessment, 'assessment');

export const getDevFirebase = (config) => {
  const configMap = {
    admin: getAdminDevFirebase,
    assessment: getAssessmentDevFirebase,
  };

  return configMap[config] ? configMap[config]() : null;
};
