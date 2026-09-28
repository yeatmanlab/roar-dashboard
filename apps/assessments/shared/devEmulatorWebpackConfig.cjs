// Ready-made webpack config fragment that defaults FIREBASE_AUTH_EMULATOR_HOST
// for local development. Merge it into the DEVELOPMENT branch only:
//
//   const { devEmulatorConfig } = require('../shared/devEmulatorWebpackConfig.cjs');
//   case 'development':
//     return merge(developmentConfig, envDependentConfig, devEmulatorConfig);
//
// Staging and production bundles must not carry this default: serve.js calls
// connectAuthEmulator() on any non-empty value, so a deployed bundle carrying
// one would authenticate end users against an emulator that issues unverified
// tokens. apps/assessments/shared/emulatorHostBuild.test.js asserts every
// bundler config keeps it out of non-development builds.
'use strict';

const webpack = require('webpack');
const { FIREBASE_EMULATOR_AUTH_HOST, FIREBASE_EMULATOR_STORAGE_HOST } = require('./devEmulatorHost.cjs');

const devEmulatorConfig = {
  plugins: [
    new webpack.EnvironmentPlugin({
      // Defaults to the local emulators — assessment development always runs
      // against the emulator stack, never a real Firebase project. Explicit
      // env vars still override these defaults (platform-context dev sets
      // FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 to target the platform
      // stack's canonical ports).
      FIREBASE_AUTH_EMULATOR_HOST: FIREBASE_EMULATOR_AUTH_HOST,
      FIREBASE_STORAGE_EMULATOR_HOST: FIREBASE_EMULATOR_STORAGE_HOST,
    }),
  ],
};

module.exports = { devEmulatorConfig };
