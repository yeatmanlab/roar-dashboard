/**
 * Guards against the Firebase Auth emulator being activated in a deployed build.
 *
 * The emulator flag short-circuits route-permission checks for super admins
 * (`usePermissions.js`) and swaps the sign-out flow, so a staging or production
 * bundle carrying it would ship those dev-only behaviours to real users.
 *
 * Both the build-time check (`vite.config.js`) and the runtime resolution
 * (`constants/firebase.js`) resolve through `findEnabledEmulatorEnvVars` below, so
 * the build cannot fire on a different set of values than the runtime honours.
 */

/**
 * Vite modes that produce a deployed artifact.
 *
 * `development` and `test` are excluded deliberately: local dev and the CI e2e job
 * both build in `development` mode, and the former legitimately enables the emulator.
 */
const DEPLOYED_MODES = ['staging', 'production'];

/**
 * Every variable that can switch the dashboard onto the local Auth emulator, with the
 * predicate deciding whether its value actually turns the emulator on.
 *
 * Add a new emulator variable here and both the build guard and the runtime flag
 * follow.
 */
const EMULATOR_ENV_VAR_PREDICATES = Object.freeze({
  VITE_FIREBASE_EMULATOR_AUTH_HOST: (value) => Boolean(value),
  VITE_FIREBASE_EMULATOR_ENABLED: (value) => value === true || value === 'true',
});

/**
 * Names the emulator variables whose value enables the emulator in the given env.
 *
 * @param {Object} env - An environment-variable bag (`process.env` or `import.meta.env`)
 * @returns {string[]} The names of the emulator variables that are enabled
 */
function findEnabledEmulatorEnvVars(env = {}) {
  return Object.keys(EMULATOR_ENV_VAR_PREDICATES).filter((name) => EMULATOR_ENV_VAR_PREDICATES[name](env[name]));
}

/**
 * Builds the error thrown when the emulator is enabled in a deployed mode.
 *
 * Names the offending variables so the failure says which value to remove.
 *
 * @param {string} mode - The deployed Vite mode
 * @param {string[]} enabled - The emulator variables that are set
 * @returns {Error} The error to throw
 */
function deployedEmulatorError(mode, enabled) {
  return new Error(
    `The Firebase Auth emulator is enabled in a "${mode}" build: ${enabled.join(', ')} is set. ` +
      'It bypasses route permission checks for super admins and must never reach a deployed build.',
  );
}

/**
 * Fails the build when a deployed mode is built with an emulator variable set.
 *
 * Vite inlines `import.meta.env` at build time, so the build is the only place to
 * catch this — by the time the bundle runs, the value is baked in.
 *
 * @param {string} mode - The Vite mode being built (development, test, staging, production)
 * @param {Object} env - The environment the build is reading from, typically `process.env`
 * @throws {Error} If `mode` is a deployed mode and any emulator variable is set
 */
export function assertEmulatorDisabledForDeployedBuild(mode, env = {}) {
  if (!DEPLOYED_MODES.includes(mode)) return;

  const enabled = findEnabledEmulatorEnvVars(env);
  if (enabled.length > 0) throw deployedEmulatorError(mode, enabled);
}

/**
 * Resolves whether the emulator is enabled, refusing to report `true` in a deployed build.
 *
 * Belt and braces behind `assertEmulatorDisabledForDeployedBuild`: that check runs in
 * the build process, so it cannot cover a bundle produced some other way (a hand-run
 * `vite build` against a patched config, a re-hosted artifact). If an emulator value
 * survives into a deployed bundle regardless, throwing here stops the app from booting
 * rather than letting it boot with super-admin route checks short-circuited.
 *
 * @param {Object} env - The build-time environment, i.e. `import.meta.env`
 * @returns {boolean} Whether the Firebase Auth emulator is enabled for this build
 * @throws {Error} If an emulator variable is set while `env.MODE` is a deployed mode
 */
export function resolveIsFirebaseEmulatorEnabled(env = {}) {
  const enabled = findEnabledEmulatorEnvVars(env);
  if (enabled.length === 0) return false;

  if (DEPLOYED_MODES.includes(env.MODE)) throw deployedEmulatorError(env.MODE, enabled);

  return true;
}
