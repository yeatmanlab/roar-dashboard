import { describe, expect, it, vi } from 'vitest';
import { escalateUnresolvedImports } from './rollupLogging.js';

/**
 * The guard's whole value is that it fails the build, so the cases that matter are the two
 * directions: UNRESOLVED_IMPORT must reach the handler as `'error'`, and nothing else may be
 * promoted. A handler called twice, or called with the original level alongside the error,
 * would let rollup continue and emit the bare specifier anyway.
 */

describe('escalateUnresolvedImports', () => {
  it('promotes an unresolved import to an error', () => {
    const handler = vi.fn();
    const log = { code: 'UNRESOLVED_IMPORT', message: '"@ts-rest/core" could not be resolved' };

    escalateUnresolvedImports('warn', log, handler);

    expect(handler).toHaveBeenCalledExactlyOnceWith('error', log);
  });

  it.each(['warn', 'info', 'debug'])('passes a %s of any other code through at its own level', (level) => {
    const handler = vi.fn();
    const log = { code: 'CIRCULAR_DEPENDENCY', message: 'a -> b -> a' };

    escalateUnresolvedImports(level, log, handler);

    expect(handler).toHaveBeenCalledExactlyOnceWith(level, log);
  });

  it('escalates regardless of the level rollup assigned', () => {
    const handler = vi.fn();

    escalateUnresolvedImports('info', { code: 'UNRESOLVED_IMPORT' }, handler);

    expect(handler).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'UNRESOLVED_IMPORT' }));
  });

  it('escalates node-resolve preferring a built-in over a local package', () => {
    const handler = vi.fn();
    // This is how a bare `path` import reached seven published bundles: node-resolve reports it
    // as a PLUGIN_WARNING, not UNRESOLVED_IMPORT, so a code-only check never saw it. Keyed on
    // pluginCode, a stable identifier, rather than the user-facing message.
    const log = { code: 'PLUGIN_WARNING', pluginCode: 'PREFER_BUILTINS', plugin: 'node-resolve' };

    escalateUnresolvedImports('warn', log, handler);

    expect(handler).toHaveBeenCalledExactlyOnceWith('error', log);
  });

  it.each([
    ['another pluginCode', { code: 'PLUGIN_WARNING', pluginCode: 'UNUSED_EXTERNAL_IMPORT', plugin: 'node-resolve' }],
    ['a warning with no pluginCode', { code: 'PLUGIN_WARNING', plugin: 'node-resolve' }],
  ])('does not escalate %s', (_label, log) => {
    const handler = vi.fn();

    escalateUnresolvedImports('warn', log, handler);

    expect(handler).toHaveBeenCalledExactlyOnceWith('warn', log);
  });

  it('tolerates a log with no code rather than throwing inside rollup', () => {
    const handler = vi.fn();
    const log = { message: 'something rollup did not classify' };

    expect(() => escalateUnresolvedImports('warn', log, handler)).not.toThrow();
    expect(handler).toHaveBeenCalledExactlyOnceWith('warn', log);
  });
});
