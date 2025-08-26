import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema.nullable(),
    error: ErrorResponseSchema.nullable(),
  });

export type ApiResponse<T extends z.ZodTypeAny> = z.infer<ReturnType<typeof ResponseSchema<T>>>;
