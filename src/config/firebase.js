import * as assessmentFirebaseConfig from '../../firebase/assessment/firebase.json';
import * as adminFirebaseConfig from '../../firebase/admin/firebase.json';

let appConfig;
let adminConfig;
if (import.meta.env.PROD) {
  appConfig = {
    apiKey: "AIzaSyDw0TnTXbvRyoVo5_oa_muhXk9q7783k_g",
    authDomain: "roar.education",
    // authDomain: "gse-roar-assessment.firebaseapp.com",
    // authDomain: "localhost:5173",
    projectId: "gse-roar-assessment",
    storageBucket: "gse-roar-assessment.appspot.com",
    messagingSenderId: "757277423033",
    appId: "1:757277423033:web:d6e204ee2dd1047cb77268"
  };

  adminConfig = {
    apiKey: "AIzaSyBz0CTdyfgNXr7VJqcYOPlG609XDs97Tn8",
    authDomain: "roar.education",
    // authDomain: "gse-roar-admin.firebaseapp.com",
    // authDomain: "localhost:5173",
    projectId: "gse-roar-admin",
    storageBucket: "gse-roar-admin.appspot.com",
    messagingSenderId: "1062489366521",
    appId: "1:1062489366521:web:d0b8b5371a67332d1d2728",
    measurementId: "G-YYE3YN0S99",
  };
} else if (import.meta.env.DEV) {
  console.log("Using firebase emulators in development mode");
  appConfig = {
    projectId: 'demo-gse-roar-assessment',
    apiKey: 'any-string-value',
    emulatorPorts: {
      db: assessmentFirebaseConfig.emulators.firestore.port,
      auth: assessmentFirebaseConfig.emulators.auth.port,
      functions: assessmentFirebaseConfig.emulators.functions.port,
    },
  };

  adminConfig = {
    projectId: 'demo-gse-roar-admin',
    apiKey: 'any-string-value',
    emulatorPorts: {
      db: adminFirebaseConfig.emulators.firestore.port,
      auth: adminFirebaseConfig.emulators.auth.port,
      functions: adminFirebaseConfig.emulators.functions.port,
    },
  };
}

export default {
  app: appConfig,
  admin: adminConfig,
};
