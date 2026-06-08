// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'cypress';
import dotenv from 'dotenv';
// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import cypressFsPlugin from 'cypress-fs/plugins/index.js';

dotenv.config({ path: '.env.test' });

export default defineConfig({
  projectId: 'o4dn8n',
  e2e: {
    experimentalRunAllSpecs: true,
    // retries: 2,
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      return cypressFsPlugin(on, config);
    },
    env: {
      baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:8000',
      timeout: 10000,
      superAdminUsername: process.env.SUPER_ADMIN_USERNAME,
      superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
      superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
      superAdminId: process.env.SUPER_ADMIN_ID,
      appCheckDebugToken: process.env.APPCHECK_DEBUG_TOKEN,
    },
  },
});
