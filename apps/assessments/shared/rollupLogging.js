/**
 * Rollup `onLog` handler that turns an unresolved import into a build failure.
 *
 * Rollup's default for a specifier it cannot resolve is to warn, leave the bare specifier in the
 * output, and exit 0 — so the failure ships a package that throws on import, behind a green CI
 * run. This escalates it. Scope is exactly that: a specifier that no reachable `node_modules`
 * provides, such as a typo or a package never installed.
 *
 * It does **not** police declarations. node-resolve walks `node_modules` upward from the
 * importing file and never reads a manifest, and npm symlinks every workspace into the root
 * `node_modules/@roar-platform/` whoever declares it — so dropping a dependency while its import
 * stays builds clean and inlines as before. `import/no-extraneous-dependencies` is the control
 * for that, not this.
 *
 * Nor does it cover a workspace dependency whose `dist/` has not been built. Both
 * `assessment-sdk` and `assessment-schema` publish an `exports` map, so node-resolve returns the
 * mapped path without stat'ing it; resolution succeeds and rollup throws separately, and loudly,
 * at load time with `Could not load … ENOENT`.
 *
 * `apps/backend/rollup.config.mjs` has the same escalation for UNRESOLVED_IMPORT; the
 * PREFER_BUILTINS arm is specific to the browser library builds.
 *
 * @param {import('rollup').LogLevel} level - Level rollup assigned to this log
 * @param {import('rollup').RollupLog} log - The log object, carrying `code`
 * @param {(level: import('rollup').LogLevel | 'error', log: import('rollup').RollupLog) => void} handler -
 *   Rollup's default handler; calling it with `'error'` aborts the build
 * @returns {void}
 */
export function escalateUnresolvedImports(level, log, handler) {
  // A backstop, not the active guard: `browserBuiltins` answers for every builtin before
  // node-resolve sees one, so this arm does not fire in any current config. It catches the
  // original bug — node-resolve reporting a preferred built-in as PLUGIN_WARNING rather than
  // UNRESOLVED_IMPORT, which is how a bare `path` reached seven published bundles — if that
  // plugin is ever dropped. Keyed on `pluginCode`, not the user-facing message.
  const preferredBuiltin = log.pluginCode === 'PREFER_BUILTINS';

  if (log.code === 'UNRESOLVED_IMPORT' || preferredBuiltin) {
    handler('error', log);
    return;
  }
  handler(level, log);
}
