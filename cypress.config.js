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
    timeout: 30000,
    sessionCookieName: process.env.SESSION_COOKIE_NAME,
    sessionCookieValue: process.env.SESSION_COOKIE_VALUE,
    superAdminUsername: process.env.SUPER_ADMIN_USERNAME,
    superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
    superAdminId: process.env.SUPER_ADMIN_ID,
    partnerAdminUsername: process.env.PARTNER_ADMIN_USERNAME,
    partnerAdminPassword: process.env.PARTNER_ADMIN_PASSWORD,
    partnerAdminId: process.env.PARTNER_ADMIN_ID,
    testAdministrationName: "zzzTestAdministration",
    testAdministratorFirstName: "zzzTestAdministratorFirstName",
    testAdministratorMiddleName: "zzzTestAdministratorMiddleName",
    testAdministratorLastName: "zzzTestAdministratorLastName",
    testAdministratorEmail: "zzzTestAdministratorEmail",
    testDistrictName: "zzzTestDistrict",
    testDistrictInitials: "TD",
    testDistrictNcesId: "123456789",
    testSchoolName: "zzzTestSchool",
    testSchoolInitials: "TS",
    testSchoolNcesId: "987654321",
    testClassName: "zzzTestClass",
    testClassInitials: "TC",
    testGroupName: "zzzTestGroup",
    testGroupInitials: "TG",
    testPartnerAdministrationName: "zzzCypressTestAdministration",
    testPartnerDistrictName: "zzzCypressTestDistrict",
    testPartnerDistrictInitials: "CTD",
    testPartnerDistrictNcesId: "123456789",
    testPartnerSchoolName: "zzzCypressTestSchool",
    testPartnerSchoolInitials: "CTS",
    testPartnerSchoolNcesId: "987654321",
    testPartnerClassName: "zzzCypressTestClass",
    testPartnerClassInitials: "CTC",
    testPartnerGroupName: "zzzCypressTestGroup",
    testPartnerGroupInitials: "CTG",
    testGrade: "Grade 5",
    stanfordUniversityAddress: "450 Jane Stanford Way, Stanford, CA 94305, USA",
    testTag: "stanford university",
    cypressDownloads: "cypress/Downloads",
  },
});