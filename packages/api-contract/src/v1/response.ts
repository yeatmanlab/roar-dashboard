import { z } from 'zod';

// Error object used inside the error envelope
export const ErrorObjectSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
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
