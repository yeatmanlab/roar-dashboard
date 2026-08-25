/**
 * Asserts that a value is unreachable, giving `switch` statements compile-time exhaustiveness.
 *
 * Call this from a `default` branch. Because the parameter is typed `never`, adding a member to
 * the switched union makes the call a compile error — which is the point. Without it, a `default`
 * branch that returns a benign value (`undefined`, an empty page) silently swallows the new
 * member at runtime instead.
 *
 * This matters most where the switched union is owned by another package: the api-contract can
 * grow a new enum member and pass Zod validation at the boundary, so the compile error is the
 * only thing standing between that and a fail-open query.
 *
 * @param value - The value that should be unreachable, narrowed to `never` by prior branches
 * @param message - Context for the thrown error, naming what was being switched on
 * @returns Never returns — always throws
 * @throws {Error} Always, reporting the unexpected value
 */
export function assertUnreachable(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}
