import cors from 'cors';
import { parseAllowedOrigins } from './parse-allowed-origins';

// Evaluated once at import time, so the allowlist is frozen for the process's lifetime;
// changing ALLOWED_ORIGINS requires a restart. This is deliberately eager (unlike the lazy
// env reads in fga.client.ts) because origins do not change within a running deployment.
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

/**
 * CORS middleware configured with allowed origins from the ALLOWED_ORIGINS env var.
 *
 * - Exact origin matching only (no regex, no wildcards)
 * - Credentials enabled (dashboard sends Authorization: Bearer)
 * - 24-hour preflight cache (browsers may cap lower: Chrome 2h, Firefox 24h)
 *
 * NOTE: CORS is a browser-side enforcement mechanism only. Non-browser clients
 * (curl, server-to-server) receive full responses regardless of origin.
 * AuthGuardMiddleware is the actual server-side access control.
 */
export const corsMiddleware = cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'sentry-trace', 'baggage'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400,
});
