import cors from 'cors';
import { parseAllowedOrigins } from './parse-allowed-origins';

// Evaluated once at import time, so the allowlist is frozen for the process's lifetime;
// changing ALLOWED_ORIGINS requires a restart. This is deliberately eager (unlike the lazy
// env reads in fga.client.ts) because origins do not change within a running deployment.
const { origins, previewPatterns } = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

/**
 * CORS middleware configured from the ALLOWED_ORIGINS env var.
 *
 * - Exact origin matching for ordinary entries (no wildcards)
 * - Anchored patterns for Firebase preview channels, built in
 *   {@link toPreviewOriginPatterns} from `https://<site>--*.web.app` entries — the
 *   one place regex matching is permitted here, because a preview URL's channel
 *   segment is not knowable in advance. Each pattern pins its site ID as a
 *   literal prefix, so the relaxation is scoped to sites ROAR owns and cannot
 *   widen to the `.web.app` namespace.
 * - Credentials enabled (dashboard sends Authorization: Bearer)
 * - 24-hour preflight cache (browsers may cap lower: Chrome 2h, Firefox 24h)
 *
 * A preview pattern admits *any* channel of its site, and channels are created by
 * CI on pull request — so this is a staging-only affordance. It is kept out of
 * production by infrastructure, which rejects the wildcard form for the prod
 * stack at plan time; nothing in this file can enforce it, because the Cloud Run
 * module sets NODE_ENV=production on both stacks and no other environment
 * discriminator reaches this container.
 *
 * NOTE: CORS is a browser-side enforcement mechanism only. Non-browser clients
 * (curl, server-to-server) receive full responses regardless of origin.
 * AuthGuardMiddleware is the actual server-side access control.
 */
export const corsMiddleware = cors({
  origin: [...origins, ...previewPatterns],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'sentry-trace', 'baggage'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400,
});
