import { z } from 'zod';

// Error object used inside the error envelope
export const ErrorObjectSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  traceId: z.string().optional(),
});

// Error envelope: { error: { message, code? } }
export const ErrorEnvelopeSchema = z.object({
  error: ErrorObjectSchema,
});

// Success envelope: { data: ... }
export const SuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  });

export type ApiError = z.infer<typeof ErrorEnvelopeSchema>;
export type ApiSuccess<T extends z.ZodTypeAny> = z.infer<ReturnType<typeof SuccessEnvelopeSchema<T>>>;

/**
 * Auth error codes that a single forced token refresh can repair.
 *
 * The backend owns the full `ApiErrorCode` vocabulary; these two members are
 * re-declared here because every client (dashboard, assessment SDK) must key
 * its 401 refresh-and-retry on the same wire values. The backend parity test
 * (`api-error-code.enum.test.ts`) pins this copy against the enum, so a
 * rename there fails the build instead of silently killing the retry path.
 */
export const RefreshableAuthErrorCode = {
  TOKEN_EXPIRED: 'auth/token-expired',
  TOKEN_INVALID: 'auth/token-invalid',
} as const;

export type RefreshableAuthErrorCode = (typeof RefreshableAuthErrorCode)[keyof typeof RefreshableAuthErrorCode];
