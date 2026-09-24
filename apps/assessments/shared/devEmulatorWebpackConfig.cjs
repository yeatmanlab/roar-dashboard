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
const { FIREBASE_EMULATOR_AUTH_HOST } = require('./devEmulatorHost.cjs');

const devEmulatorConfig = {
  plugins: [
    new webpack.EnvironmentPlugin({
      // Defaults to the local Auth emulator — assessment development always runs
      // against the emulator, never a real Firebase project. An explicit
      // FIREBASE_AUTH_EMULATOR_HOST env var still overrides this default.
      FIREBASE_AUTH_EMULATOR_HOST: FIREBASE_EMULATOR_AUTH_HOST,
    }),
  ],
};

module.exports = { devEmulatorConfig };
