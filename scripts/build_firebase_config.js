import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

export const buildFirebaseConfig = (mode = 'development') => {
  const allowedModes = ['development', 'staging', 'production'];
  if (!allowedModes.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Expected one of: ${allowedModes.join(', ')}`);
  }

  // The sentry environment uses "staging" for dev.
  const sentryEnv = mode === 'development' ? 'staging' : mode;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, '..');

  // Validate required environment variables
  const requiredEnvVars = ['VITE_FIREBASE_ADMIN_PROJECT_ID', 'VITE_FIREBASE_APP_PROJECT_ID'];
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missingEnvVars.length > 0) console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  const { VITE_FIREBASE_ADMIN_PROJECT_ID, VITE_FIREBASE_APP_PROJECT_ID } = process.env;

  // Utility function to replace environment variables in a string
  const replaceEnvVars = (str) => {
    return str
      .replace(/__SENTRY_ENV__/g, sentryEnv)
      .replace(/__ADMIN_PROJECT_ID__/g, VITE_FIREBASE_ADMIN_PROJECT_ID)
      .replace(/__ASSESSMENT_PROJECT_ID__/g, VITE_FIREBASE_APP_PROJECT_ID);
  };

  // Read and token-replace CSP template
  const cspTemplatePath = path.join(root, 'firebase', 'admin', 'csp.template.json');
  const cspTemplate = replaceEnvVars(readFileSync(cspTemplatePath, 'utf8'));
  const cspObj = JSON.parse(cspTemplate);

  // Join arrays into single-line policy
  const cspPolicy = Object.entries(cspObj)
    .map(([dir, vals]) => `${dir} ${vals.join(' ')}`)
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim();

  // Build firebase.json from firebase.template.json
  const fbTemplatePath = path.join(root, 'firebase', 'admin', 'firebase.template.json');
  const fbTemplate = replaceEnvVars(readFileSync(fbTemplatePath, 'utf8'));
  const fbObj = JSON.parse(fbTemplate);

  // Replace header with the generated CSP policy
  const header = fbObj.hosting.headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === 'Content-Security-Policy-Report-Only');

  if (!header) throw new Error('CSP header not found');
  header.value = cspPolicy;

  // Write output
  const outPath = path.join(root, 'firebase', 'admin', 'firebase.json');
  writeFileSync(outPath, JSON.stringify(fbObj, null, 2));
  console.log(`✅ Generated ${outPath} for environment ${mode}`);
};
