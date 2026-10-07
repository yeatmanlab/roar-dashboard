import type { RequestHandler } from 'express';
import type { TsRestRequestHandler } from '@ts-rest/express';
import type { AppRoute, AppRouter } from '@ts-rest/core';

/**
 * Re-types an Express middleware as a ts-rest route middleware.
 *
 * ts-rest types `req.query` (and `params`/`body`) as the *parsed* Zod output, so a route
 * with `query: z.object({ page: z.number() })` gets `query.page: number`. Express's own
 * `RequestHandler` insists on `ParsedQs`, where every value is a string. The two are
 * genuinely incompatible, which is why attaching a plain Express handler to a route that
 * declares a `query` schema does not type-check — routes without one, such as `/me`, never
 * hit the mismatch.
 *
 * Suppressing that per attachment site (27 `@ts-expect-error` comments across 11 route
 * files) also suppressed everything else about the line: a typo in the middleware name, or
 * dropping the guard entirely, still compiled. This wrapper narrows the escape hatch to one
 * place and keeps the identifier itself checked at every call site.
 *
 * Sound only for middleware that does not read the request's parsed `query`, `params`, or
 * `body` — it reads `headers` and assigns `req.user`, both of which are identical across
 * the two request types. Do not use it to adapt middleware that inspects parsed input.
 *
 * The route type is inferred from the call site, because `TsRestRequestHandler` is invariant
 * in that parameter — a handler typed over a union of routes is not assignable to a handler
 * for one specific route.
 *
 * @param middleware - An Express middleware that touches only transport-level fields.
 * @returns The same function, typed as a ts-rest middleware for the inferred route.
 */
export function asTsRestMiddleware<T extends AppRouter | AppRoute>(
  middleware: RequestHandler,
): TsRestRequestHandler<T> {
  return middleware as unknown as TsRestRequestHandler<T>;
}
