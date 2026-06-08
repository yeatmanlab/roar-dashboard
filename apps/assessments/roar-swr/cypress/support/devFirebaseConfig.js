const devFirebaseConfig = {
  adminDev: {
    apiKey: 'AIzaSyCl-JsYraUfofQZXpzshQ6s-E0nYzlCvvg',
    authDomain: 'gse-roar-admin-dev.firebaseapp.com',
    projectId: 'gse-roar-admin-dev',
    storageBucket: 'gse-roar-admin-dev.appspot.com',
    messagingSenderId: '401455396681',
    appId: '1:401455396681:web:859ea073a116d0aececc98',
    siteKey: '6LeTgCEqAAAAAPVXEVtWoinVf_CLYF30PaETyyiT',
    debugToken: Cypress.env('appCheckDebugToken'),
  },
  assessmentDev: {
    apiKey: 'AIzaSyCEUxEgYMp4fg2zORT0lsgn4Q6CCoMVzjU',
    authDomain: 'gse-roar-assessment-dev.firebaseapp.com',
    projectId: 'gse-roar-assessment-dev',
    storageBucket: 'gse-roar-assessment-dev.appspot.com',
    messagingSenderId: '26086061121',
    appId: '1:26086061121:web:262163d6c145b7a80bc2c0',
    siteKey: '6Ldq2SEqAAAAAKXTxXs9GnykkEZLYeVijzAKzqfQ',
    debugToken: Cypress.env('appCheckDebugToken'),
    emulatorPorts: {
      db: 8080,
      auth: 9099,
      functions: 9000,
      hosting: 5000,
    },
  },
};

export default devFirebaseConfig;
