const { defineConfig } = require("cypress");
require('dotenv').config()

module.exports = defineConfig({
  projectId: "cobw62",
  e2e: {
    baseUrl: "https://localhost:5173/",
    experimentalRunAllSpecs: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    // specPattern: [
    //
    // ]
  },
  env: {
    baseUrl: "https://localhost:5173",
    timeout: 10000,
    superAdminUsername: process.env.SUPER_ADMIN_USERNAME,
    superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
    sessionCookieName: process.env.SESSION_COOKIE_NAME,
    sessionCookieValue: process.env.SESSION_COOKIE_VALUE,
    testAdministrationName: "###testAdministration",
    testAdministratorFirstName: "###testAdministratorFirstName",
    testAdministratorMiddleName: "###testAdministratorMiddleName",
    testAdministratorLastName: "###testAdministratorLastName",
    testAdministratorEmail: "###testAdministratorEmail",
    testDistrictName: "###testDistrict",
    testDistrictInitials: "TD",
    testDistrictNcesId: "123456789",
    testSchoolName: "###testSchool",
    testSchoolInitials: "TS",
    testSchoolNcesId: "987654321",
    testClassName: "###testClass",
    testClassInitials: "TC",
    testGroupName: "###testGroup",
    testGroupInitials: "TG",
    testGrade: "Grade 5",
    stanfordUniversityAddress: "450 Jane Stanford Way, Stanford, CA 94305, USA",
    testTag: "stanford university",
  },
});


