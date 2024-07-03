let appConfig; // assessment project
let adminConfig;

if (import.meta.env.VITE_FIREBASE_PROJECT === 'DEV') {
  appConfig = {
    apiKey: 'AIzaSyC9IoJBEyN-BxHobeoMQRuEu0CtyQDOg8k',
    authDomain: 'hs-levante-assessment-dev.firebaseapp.com',
    projectId: 'hs-levante-assessment-dev',
    storageBucket: 'hs-levante-assessment-dev.appspot.com',
    messagingSenderId: '46792247600',
    appId: '1:46792247600:web:ea20e1fe94e0541dd5a0f5',
  };

  adminConfig = {
    apiKey: 'AIzaSyCOzRA9a2sDHtVlX7qnszxrgsRCBLyf5p0',
    authDomain: 'hs-levante-admin-dev.firebaseapp.com',
    projectId: 'hs-levante-admin-dev',
    storageBucket: 'hs-levante-admin-dev.appspot.com',
    messagingSenderId: '41590333418',
    appId: '1:41590333418:web:3468a7caadab802d6e5c93',
  };
} else {
  // production
  appConfig = {
    apiKey: 'AIzaSyCdAa6P5Ot8jjnKAi_FNLDfvWP_rDqeQYg',
    authDomain: 'hs-levante-assessment-prod.firebaseapp.com',
    projectId: 'hs-levante-assessment-prod',
    storageBucket: 'hs-levante-assessment-prod.appspot.com',
    messagingSenderId: '928482088295',
    appId: '1:928482088295:web:1cab64d5dccb2d19ae8bc2',
  };

  adminConfig = {
    apiKey: 'AIzaSyCcnmBCojjK0_Ia87f0SqclSOihhKVD3f8',
    authDomain: 'hs-levante-admin-prod.firebaseapp.com',
    projectId: 'hs-levante-admin-prod',
    storageBucket: 'hs-levante-admin-prod.appspot.com',
    messagingSenderId: '348449903279',
    appId: '1:348449903279:web:a1b9dad734e2237c7ffa5a',
  };
}

export default {
  app: appConfig,
  admin: adminConfig,
};
