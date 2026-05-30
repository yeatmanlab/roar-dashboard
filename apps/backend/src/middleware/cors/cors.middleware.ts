import cors from 'cors';
import { parseAllowedOrigins } from './parse-allowed-origins';

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
