// Ready-made webpack config fragment for DEVELOPMENT builds. Merge it into the
// development branch only:
//
//   const { devConfig } = require('../shared/devWebpackConfig.cjs');
//   case 'development':
//     return merge(developmentConfig, envDependentConfig, devConfig);
//
// It carries two concerns every assessment shares:
//
// 1. The emulator-host defaults. Staging and production bundles must not carry
//    these: serve.js calls connectAuthEmulator() on any non-empty value, so a
//    deployed bundle carrying one would authenticate end users against an
//    emulator that issues unverified tokens (and upload recordings to a dead
//    Storage emulator). apps/assessments/shared/emulatorHostBuild.test.js
//    asserts every bundler config keeps them out of non-development builds.
//
// 2. Quiet dev-server output. The researcher-facing `npm start` hands off to
//    webpack-dev-server; without these settings every rebuild prints a full
//    asset/module listing and proxy/URL infrastructure logs. Errors and
//    warnings still print in full.
'use strict';

const webpack = require('webpack');
const { FIREBASE_EMULATOR_AUTH_HOST, FIREBASE_EMULATOR_STORAGE_HOST } = require('./devEmulatorHost.cjs');

const devConfig = {
  stats: 'errors-warnings',
  infrastructureLogging: { level: 'warn' },
  devServer: {
    client: { logging: 'warn' },
  },
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

module.exports = { devConfig };
