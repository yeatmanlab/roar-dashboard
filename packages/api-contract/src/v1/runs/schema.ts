import { z } from 'zod';

const MAX_METADATA_SIZE = 1024;

function jsonByteSize(value: unknown): number {
  const json = JSON.stringify(value);
  return new TextEncoder().encode(json).length;
}

/**
 * Request body for POST /runs
 */
export const CreateRunRequestBodySchema = z.object({
  task_variant_id: z.string().uuid(),
  task_version: z.string(),
  administration_id: z.string().uuid(),
  metadata: z
    .record(z.unknown())
    .optional()
    .superRefine((metadata, context) => {
      if (!metadata) return;

      try {
        const bytes = jsonByteSize(metadata);
        if (bytes > MAX_METADATA_SIZE) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `metadata is too large (${bytes} bytes). Max is ${MAX_METADATA_SIZE} bytes.`,
          });
        }
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'metadata must be JSON-serializable',
        });
      }
    }),
});

export type CreateRunRequestBody = z.infer<typeof CreateRunRequestBodySchema>;

/**
 * Response payload for POST /runs
 */
export const CreateRunResponseSchema = z.object({
  run_id: z.string().uuid(),
});

/**
 * Schema for a run completion event.
 *
 * Represents an event that marks a run as complete.
 * - type: Must be 'complete' (literal type for discriminated union)
 * - metadata: Optional metadata about the completion (e.g., final score, session info)
 */
export const RunCompleteEventSchema = z.object({
  type: z.literal('complete'),
  metadata: z
    .record(z.unknown())
    .optional()
    .superRefine((metadata, context) => {
      if (!metadata) return;

      try {
        const bytes = jsonByteSize(metadata);
        if (bytes > MAX_METADATA_SIZE) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `metadata is too large (${bytes} bytes). Max is ${MAX_METADATA_SIZE} bytes.`,
          });
        }
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'metadata must be JSON-serializable',
        });
      }
    }),
});
/**
 * Schema for a run abort event.
 *
 * Represents an event that marks a run as aborted.
 * - type: Must be 'abort' (literal type for discriminated union)
 * - reason: Optional reason for the abort
 */
export const RunAbortEventSchema = z.object({
  type: z.literal('abort'),
  reason: z.string().min(1).optional(),
});

/**
 * Discriminated union schema for run events.
 */
export const RunEventBodySchema = z.discriminatedUnion('type', [RunCompleteEventSchema, RunAbortEventSchema]);

export type RunEventBody = z.infer<typeof RunEventBodySchema>;
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;
