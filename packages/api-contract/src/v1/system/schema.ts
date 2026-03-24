import { z } from 'zod';

/**
 * Query parameters for the FGA backfill endpoint.
 *
 * @property dryRun - When true, returns tuple counts without writing to FGA
 */
export const BackfillFgaQuerySchema = z.object({
  dryRun: z.coerce.boolean().optional().default(false),
});

export type BackfillFgaQuery = z.infer<typeof BackfillFgaQuerySchema>;

/**
 * Per-category tuple counts from the backfill operation.
 */
export const BackfillCategoriesSchema = z.object({
  orgHierarchy: z.number(),
  orgMemberships: z.number(),
  classMemberships: z.number(),
  groupMemberships: z.number(),
  familyMemberships: z.number(),
  administrationAssignments: z.number(),
});

export type BackfillCategories = z.infer<typeof BackfillCategoriesSchema>;

/**
 * Response body for the FGA backfill endpoint.
 */
export const BackfillFgaResponseSchema = z.object({
  dryRun: z.boolean(),
  categories: BackfillCategoriesSchema,
  totalTuples: z.number(),
});

export type BackfillFgaResponse = z.infer<typeof BackfillFgaResponseSchema>;

/**
 * Response body when a non-dry-run backfill is accepted for async processing.
 */
export const BackfillFgaAcceptedSchema = z.object({
  message: z.string(),
});

export type BackfillFgaAccepted = z.infer<typeof BackfillFgaAcceptedSchema>;
