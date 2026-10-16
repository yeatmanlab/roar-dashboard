import { isBuiltin } from 'node:module';

/**
 * Browser shims for the Node builtins a library build reaches.
 *
 * Every node-resolve outcome for a builtin is wrong for a browser bundle, and only one of them
 * is even noisy:
 *
 * - Default `preferBuiltins`: `path` is left as a bare specifier in `dist/index.js`. node-resolve
 *   warns, but as `PLUGIN_WARNING` / `PREFER_BUILTINS`, which is how a bare `path` reached seven
 *   published bundles before this existed.
 * - `preferBuiltins: false`: node-resolve picks whatever same-named userland package happens to
 *   be hoisted. The monorepo has nine — `assert`, `buffer`, `events`, `path`, `process`,
 *   `punycode`, `string_decoder`, `url`, `util` — none declared by any workspace. `path@0.12.7`
 *   reads `process.platform` at module scope, so it throws on load without a `process` polyfill.
 * - Either way a builtin with no hoisted twin (`fs`, `os`, `node:path`) is externalized with no
 *   log at all. `MISSING_NODE_BUILTINS` does not fire for `format: 'es'`.
 *
 * So this plugin takes the decision away from node-resolve: shimmed builtins resolve to the shim,
 * and the rest are marked external deliberately rather than by default.
 *
 * It does **not** fail the build on an unshimmed builtin. Resolution runs before tree-shaking, so
 * a builtin reached only on a dead branch — `crypto`, in roav-apps' dependency graph — is resolved
 * and then dropped, and erroring here would fail a build over an import no consumer ever sees.
 * The consequence is that a builtin which *does* survive into a bundle is not caught at build
 * time; add a shim here when one shows up.
 *
 * @type {import('rollup').Plugin}
 */
export const browserBuiltins = {
  name: 'browser-builtins',

  async resolveId(source, importer) {
    if (!isBuiltin(source)) return null;

    const shim = BROWSER_SHIMS.get(source);
    if (!shim) {
      // node-resolve gets first refusal, because a dependency that neutralizes its own Node-only
      // imports the standard way — `"browser": { "crypto": false }`, which roar-multichoice
      // declares — gets an empty stub from it. Answering here would make that field inert.
      const byConvention = await this.resolve(source, importer, { skipSelf: true });
      return byConvention ?? { id: source, external: true };
    }

    // this.resolve() returns null rather than throwing, and returning null here would hand the
    // specifier back to node-resolve — silently restoring the behaviour above.
    const resolved = await this.resolve(shim, undefined, { skipSelf: true });
    if (!resolved) {
      this.error(
        `'${source}' maps to '${shim}', which could not be resolved. Add '${shim}' to this ` +
          `assessment's devDependencies.`,
      );
    }
    return resolved;
  },
};

/** Builtin specifier → browser replacement. Both spellings, since either can appear. */
const BROWSER_SHIMS = new Map([
  ['path', 'path-browserify'],
  ['node:path', 'path-browserify'],
]);
