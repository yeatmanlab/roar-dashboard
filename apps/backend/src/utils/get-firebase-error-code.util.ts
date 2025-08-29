export function getFirebaseErrorCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;

  const withCode = e as { code?: unknown; errorInfo?: unknown };
  if (typeof withCode.code === 'string') return withCode.code;

  const info = withCode.errorInfo as { code?: unknown } | undefined;
  if (info && typeof info.code === 'string') return info.code;

  return undefined;
}
