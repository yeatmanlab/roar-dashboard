/** Port and HTTP(S) probes. */
import http from 'node:http';
import https from 'node:https';
import { capture } from './proc.mjs';

/**
 * True when the given TCP port is already bound (lsof on macOS, ss on Linux;
 * both tolerate the tool being absent).
 *
 * @param {string|number} port
 */
export function portInUse(port) {
  const lsof = capture(['lsof', '-i', `:${port}`, '-sTCP:LISTEN']);
  if (lsof.ok && lsof.stdout) return true;
  const ss = capture(['ss', '-tlnp']);
  return ss.ok && ss.stdout.split('\n').some((line) => line.includes(`:${port} `));
}

/**
 * GET-probes a URL with a short timeout. Self-signed dev TLS certificates are
 * accepted — the probe answers "is something serving here", not "is the chain
 * trusted".
 *
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>} True on a 2xx/3xx response (`curl -sf` parity).
 */
export function probe(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { rejectUnauthorized: false, timeout: timeoutMs }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 400);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}
