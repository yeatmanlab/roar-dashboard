const { defineConfig } = require("cypress");
require('dotenv').config()

module.exports = defineConfig({
  projectId: 'cobw62',
  e2e: {
    baseUrl: "https://localhost:5173",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  env: {
    googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    superAdminUsername: process.env.SUPER_ADMIN_USERNAME,
    superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
  },
});


