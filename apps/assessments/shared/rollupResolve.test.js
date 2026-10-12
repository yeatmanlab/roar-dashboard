import { describe, expect, it, vi } from 'vitest';
import { browserBuiltins } from './rollupResolve.js';

/**
 * Every outcome node-resolve produces for a Node builtin is wrong for a browser bundle, and only
 * one of them logs anything — so these cases pin the mapping and, more importantly, that nothing
 * else gets through quietly.
 */

/** @returns A minimal rollup plugin context; `error` throws, as rollup's does. */
function pluginContext({ resolve = vi.fn().mockResolvedValue({ id: '/shim.js' }) } = {}) {
  return {
    resolve,
    error(message) {
      throw new Error(typeof message === 'string' ? message : message.message);
    },
  };
}

describe('browserBuiltins', () => {
  it.each(['path', 'node:path'])('maps %s to the browser shim', async (source) => {
    const ctx = pluginContext();

    const result = await browserBuiltins.resolveId.call(ctx, source);

    expect(ctx.resolve).toHaveBeenCalledWith('path-browserify', undefined, { skipSelf: true });
    expect(result).toEqual({ id: '/shim.js' });
  });

  it.each(['fs', 'os', 'crypto', 'node:fs', 'util'])(
    'lets node-resolve answer for unshimmed builtin %s',
    async (source) => {
      // A dependency that neutralizes its own Node-only imports via `"browser": { "crypto":
      // false }` — roar-multichoice declares exactly that — gets an empty stub from node-resolve.
      // Answering here would make that field inert.
      const stub = { id: '\0browser-stub', external: false };
      const ctx = pluginContext({ resolve: vi.fn().mockResolvedValue(stub) });

      expect(await browserBuiltins.resolveId.call(ctx, source, '/importer.js')).toBe(stub);
      expect(ctx.resolve).toHaveBeenCalledWith(source, '/importer.js', { skipSelf: true });
    },
  );

  it.each(['fs', 'crypto'])('marks unshimmed builtin %s external when nothing resolves it', async (source) => {
    // Deliberately external, not an error: resolution runs before tree-shaking, so a builtin
    // reached only on a dead branch (crypto, in roav-apps' graph) would fail a build over an
    // import no consumer sees.
    const ctx = pluginContext({ resolve: vi.fn().mockResolvedValue(null) });

    expect(await browserBuiltins.resolveId.call(ctx, source, undefined)).toEqual({ id: source, external: true });
  });

  it('fails the build when the shim itself cannot be resolved', async () => {
    // this.resolve() returns null rather than throwing; returning null here would hand the
    // specifier back to node-resolve and silently restore the old behaviour.
    const ctx = pluginContext({ resolve: vi.fn().mockResolvedValue(null) });

    await expect(browserBuiltins.resolveId.call(ctx, 'path')).rejects.toThrow(/devDependencies/);
  });

  it.each(['path-browserify', './path', 'lodash/merge', '@roar-platform/assessment-sdk'])(
    'leaves non-builtin %s to node-resolve',
    async (source) => {
      const ctx = pluginContext();

      expect(await browserBuiltins.resolveId.call(ctx, source)).toBeNull();
      expect(ctx.resolve).not.toHaveBeenCalled();
    },
  );
});
