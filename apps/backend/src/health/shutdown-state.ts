let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function setShuttingDown(): void {
  shuttingDown = true;
}

/**
 * Reset the shutdown flag to false.
 *
 * @internal Exposed for testing only. Do not call in production code.
 */
export function resetShuttingDown(): void {
  shuttingDown = false;
}
