// Single source of truth for the emulator hosts that dev-mode bundler configs
// default FIREBASE_AUTH_EMULATOR_HOST / FIREBASE_STORAGE_EMULATOR_HOST to.
//
// The assessment stack publishes the emulators on 9097/9197 — deliberately NOT
// the canonical 9099/9199 the platform stack uses — so both dev environments
// run in parallel with no port overlap. The ports are shifted in the emulator
// config itself (docker/firebase-emulator/firebase.assessment.json) and mapped
// 1:1 in docker-compose.assessment.yml — the Emulator UI builds browser-side
// URLs from the advertised config ports, so a Docker-level remap would point
// it at the platform stack. All three must match these values;
// emulatorPortConfig.test.js asserts the agreement.
// Platform-context dev (assessment served against the platform stack) opts in
// explicitly: FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev.
//
// CommonJS (.cjs) so the webpack .cjs configs can require() it; ESM configs
// (vite) import it via Node's CJS interop. Deliberately not exported from
// @roar-platform/assessment-schema: that package is ESM-only and require(ESM)
// needs Node >= 22.12, which the build tooling can't assume.
'use strict';

const FIREBASE_EMULATOR_AUTH_HOST = '127.0.0.1:9097';
const FIREBASE_EMULATOR_STORAGE_HOST = '127.0.0.1:9197';

module.exports = { FIREBASE_EMULATOR_AUTH_HOST, FIREBASE_EMULATOR_STORAGE_HOST };
