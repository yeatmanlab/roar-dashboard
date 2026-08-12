import cors from 'cors';
import { parseAllowedOrigins } from './parse-allowed-origins';
import { parsePreviewOrigins } from './parse-preview-origins';

// Evaluated once at import time, so the allowlist is frozen for the process's lifetime;
// changing ALLOWED_ORIGINS requires a restart. This is deliberately eager (unlike the lazy
// env reads in fga.client.ts) because origins do not change within a running deployment.
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

// Empty in production: the infrastructure omits this variable for the prod stack, so the
// allowlist below reduces to exact matching there.
const previewOrigins = parsePreviewOrigins(process.env.ALLOWED_FIREBASE_ASSESSMENT_PREVIEW_SITES);

/**
 * CORS middleware configured from the ALLOWED_ORIGINS and
 * ALLOWED_FIREBASE_ASSESSMENT_PREVIEW_SITES env vars.
 *
 * - Exact origin matching for ALLOWED_ORIGINS (no wildcards)
 * - Anchored per-site patterns for Firebase preview channels, built in
 *   {@link parsePreviewOrigins} from bare site IDs — the one place regex matching
 *   is permitted here, because a preview URL's channel segment is not knowable in
 *   advance. Each pattern pins its site ID as a literal prefix, so the relaxation
 *   is scoped to sites ROAR owns and cannot widen to the `.web.app` namespace.
 * - Credentials enabled (dashboard sends Authorization: Bearer)
 * - 24-hour preflight cache (browsers may cap lower: Chrome 2h, Firefox 24h)
 *
 * A preview pattern admits *any* channel of its site, and channels are created by
 * CI on pull request — so this is a staging-only affordance, kept out of
 * production by omitting the variable there rather than by anything in this file.
 *
 * That exclusion cannot be enforced locally: the Cloud Run module sets
 * NODE_ENV=production on the staging and production services alike, and no other
 * environment discriminator reaches this container, so a NODE_ENV check here would
 * disable preview origins in staging — the only place they are meant to work —
 * while every test in this repo still passed. The guard therefore lives in
 * infrastructure, which does know which stack it is deploying: services/backend-api
 * /config.ts forces the site list empty for prod, covered by a test asserting it
 * stays empty even when the stack config supplies one.
 *
 * NOTE: CORS is a browser-side enforcement mechanism only. Non-browser clients
 * (curl, server-to-server) receive full responses regardless of origin.
 * AuthGuardMiddleware is the actual server-side access control.
 */
export const corsMiddleware = cors({
  origin: [...allowedOrigins, ...previewOrigins],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'sentry-trace', 'baggage'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400,
});
