import helmet from 'helmet';

/**
 * Security headers middleware via Helmet.
 *
 * Enabled: CSP (default-src 'none'), frameguard (DENY), nosniff, HSTS,
 * X-DNS-Prefetch-Control, X-Permitted-Cross-Domain-Policies.
 *
 * Disabled: COEP, COOP, CORP, originAgentCluster — these are document/frame
 * concerns not applicable to a JSON API, and CORP would block legitimate
 * cross-origin fetch() even with CORS headers.
 */
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
});
