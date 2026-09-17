// In SDK context, all sessions are ROAR sessions — no Firebase project ID check needed.
export function isRoarApp(): boolean {
  return true;
}
