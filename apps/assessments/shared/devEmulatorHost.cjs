// Single source of truth for the Auth emulator host that dev-mode bundler
// configs default FIREBASE_AUTH_EMULATOR_HOST to. Must match the auth emulator
// port in docker/firebase-emulator/firebase.json and the compose port mappings.
//
// CommonJS (.cjs) so the webpack .cjs configs can require() it; ESM configs
// (vite) import it via Node's CJS interop. Deliberately not exported from
// @roar-platform/assessment-schema: that package is ESM-only and require(ESM)
// needs Node >= 22.12, which the build tooling can't assume.
'use strict';

const FIREBASE_EMULATOR_AUTH_HOST = '127.0.0.1:9099';

module.exports = { FIREBASE_EMULATOR_AUTH_HOST };
