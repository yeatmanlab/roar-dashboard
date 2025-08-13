#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadDotenvFiles } from './load_dot_env_files.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment can be supplied as the first CLI arg, e.g.
//   node scripts/build_firebase_config.js staging
// Falls back to the FIREBASE_ENV environment variable, then to "production".
const cliEnv = process.argv[2]; // dev | staging | production
const env = cliEnv || process.env.FIREBASE_ENV || 'production'; // default production
loadDotenvFiles(env);

const requiredEnvVars = ['VITE_FIREBASE_ADMIN_PROJECT_ID', 'VITE_FIREBASE_APP_PROJECT_ID'];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);

const { VITE_FIREBASE_ADMIN_PROJECT_ID, VITE_FIREBASE_APP_PROJECT_ID } = process.env;

const root = path.resolve(__dirname, '..');

// 1. read and token-replace template
let tpl = readFileSync(path.join(root, 'firebase', 'admin', 'csp.template.json'), 'utf8')
  .replace(/__ENV__/g, env)
  .replace(/__ADMIN_PROJECT_ID__/g, VITE_FIREBASE_ADMIN_PROJECT_ID)
  .replace(/__ASSESSMENT_PROJECT_ID__/g, VITE_FIREBASE_APP_PROJECT_ID);

const cspObj = JSON.parse(tpl);

// 2. join arrays into single-line policy
const policy = Object.entries(cspObj)
  .map(([dir, vals]) => `${dir} ${vals.join(' ')}`)
  .join('; ')
  .replace(/\s+/g, ' ')
  .trim();

// 3. inject into firebase.<env>.json
const filename = `firebase.${env}.json`;
const cfgPath = path.join(root, 'firebase', 'admin', filename);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

const hdr = cfg.hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy-Report-Only');
if (!hdr) throw new Error('CSP header not found');

hdr.value = policy;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log(`✅ Created CSP for ${env} environment in ${filename}`);
