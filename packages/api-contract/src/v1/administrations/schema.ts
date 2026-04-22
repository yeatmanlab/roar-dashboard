import { z } from 'zod';
import { ConditionSchema } from '../common/condition';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';
import { AgreementTypeSchema, LocaleSchema } from '../agreements/schema';
export type { AgreementType, Locale } from '../agreements/schema';

/**
 * Administration status values for filtering.
 * - active: dateStart <= now <= dateEnd
 * - past: dateEnd < now
 * - upcoming: dateStart > now
 */
export const ADMINISTRATION_STATUS_VALUES = ['active', 'past', 'upcoming'] as const;

/**
 * Schema for administration status filter.
 */
export const AdministrationStatusSchema = z.enum(ADMINISTRATION_STATUS_VALUES);

export type AdministrationStatus = z.infer<typeof AdministrationStatusSchema>;

/**
 * Administration dates schema.
 */
export const AdministrationDatesSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  created: z.string().datetime(),
});

export type AdministrationDates = z.infer<typeof AdministrationDatesSchema>;

/**
 * Administration stats schema (embedded via ?embed=stats).
 */
export const AdministrationStatsSchema = z.object({
  assigned: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
});

export type AdministrationStats = z.infer<typeof AdministrationStatsSchema>;

/**
 * Administration task schema (embedded via ?embed=tasks).
 */
export const AdministrationTaskSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  variantId: z.string().uuid(),
  variantName: z.string().nullable(),
  orderIndex: z.number().int(),
});

export type AdministrationTask = z.infer<typeof AdministrationTaskSchema>;

/**
 * Base administration schema (without embedded data).
 */
export const AdministrationBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  publicName: z.string(),
  dates: AdministrationDatesSchema,
  isOrdered: z.boolean(),
});

export type AdministrationBase = z.infer<typeof AdministrationBaseSchema>;

/**
 * Full administration schema with optional embedded data.
 */
export const AdministrationSchema = AdministrationBaseSchema.extend({
  stats: AdministrationStatsSchema.optional(),
  tasks: z.array(AdministrationTaskSchema).optional(),
});

export type Administration = z.infer<typeof AdministrationSchema>;

/**
 * Allowed sort fields for administrations.
 */
export const ADMINISTRATION_SORT_FIELDS = ['createdAt', 'name', 'dateStart', 'dateEnd'] as const;

/**
 * Sort field type for administrations.
 */
export type AdministrationSortFieldType = (typeof ADMINISTRATION_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const AdministrationSortField = {
  CREATED_AT: 'createdAt',
  NAME: 'name',
  DATE_START: 'dateStart',
  DATE_END: 'dateEnd',
} as const satisfies Record<string, AdministrationSortFieldType>;

/**
 * Allowed embed options for administrations.
 * - 'stats': Include assigned user count and run statistics (started/completed)
 * - 'tasks': Include task variants assigned to the administration
 */
export const ADMINISTRATION_EMBED_OPTIONS = ['stats', 'tasks'] as const;

/**
 * Embed option type for administrations.
 */
export type AdministrationEmbedOptionType = (typeof ADMINISTRATION_EMBED_OPTIONS)[number];

/**
 * Embed option constants for type-safe access.
 */
export const AdministrationEmbedOption = {
  STATS: 'stats',
  TASKS: 'tasks',
} as const satisfies Record<string, AdministrationEmbedOptionType>;

/**
 * Query parameters for listing administrations.
 */
export const AdministrationsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ADMINISTRATION_SORT_FIELDS, 'createdAt'),
)
  .merge(createEmbedQuerySchema(ADMINISTRATION_EMBED_OPTIONS))
  .extend({
    status: AdministrationStatusSchema.optional(),
  });

export type AdministrationsListQuery = z.infer<typeof AdministrationsListQuerySchema>;

/**
 * Paginated response for administrations list.
 */
export const AdministrationsListResponseSchema = createPaginatedResponseSchema(AdministrationSchema);

export type AdministrationsListResponse = z.infer<typeof AdministrationsListResponseSchema>;

/**
 * District entity in the assignees response.
 */
export const AssigneeDistrictSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type AssigneeDistrict = z.infer<typeof AssigneeDistrictSchema>;

/**
 * School entity in the assignees response.
 * Includes parentOrgId so the frontend can build the tree hierarchy.
 */
export const AssigneeSchoolSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  parentOrgId: z.string().uuid(),
});

export type AssigneeSchool = z.infer<typeof AssigneeSchoolSchema>;

/**
 * Class entity in the assignees response.
 * Includes schoolId and districtId for the full parent chain.
 */
export const AssigneeClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  schoolId: z.string().uuid(),
  districtId: z.string().uuid(),
});

export type AssigneeClass = z.infer<typeof AssigneeClassSchema>;

/**
 * Group entity in the assignees response.
 * Groups are flat — no parent references.
 */
export const AssigneeGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type AssigneeGroup = z.infer<typeof AssigneeGroupSchema>;

/**
 * Response schema for GET /administrations/:id/assignees.
 *
 * Returns entities directly assigned to an administration via junction tables,
 * grouped by type. No pagination — administrations are assigned to a small
 * number of entities.
 */
export const AdministrationAssigneesResponseSchema = z.object({
  districts: z.array(AssigneeDistrictSchema),
  schools: z.array(AssigneeSchoolSchema),
  classes: z.array(AssigneeClassSchema),
  groups: z.array(AssigneeGroupSchema),
});

export type AdministrationAssigneesResponse = z.infer<typeof AdministrationAssigneesResponseSchema>;

/**
 * Allowed sort fields for administration task variants.
 */
export const ADMINISTRATION_TASK_VARIANT_SORT_FIELDS = ['orderIndex', 'name'] as const;

/**
 * Sort field type for administration task variants.
 */
export type AdministrationTaskVariantSortFieldType = (typeof ADMINISTRATION_TASK_VARIANT_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const AdministrationTaskVariantSortField = {
  ORDER_INDEX: 'orderIndex',
  NAME: 'name',
} as const satisfies Record<string, AdministrationTaskVariantSortFieldType>;

/**
 * Query parameters for listing administration task variants.
 * Defaults to ascending order (0 → 1 → 2) since orderIndex represents assessment sequence.
 */
export const AdministrationTaskVariantsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ADMINISTRATION_TASK_VARIANT_SORT_FIELDS, 'orderIndex'),
).extend({
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type AdministrationTaskVariantsListQuery = z.infer<typeof AdministrationTaskVariantsListQuerySchema>;

/**
 * Task information nested within task variant response.
 */
export const AdministrationTaskVariantTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  tutorialVideo: z.string().nullable(),
});

/**
 * Conditions for task variant assignment within an administration.
 *
 * The response structure differs based on the user's role:
 *
 * ## Supervisory roles (teachers, admins, super admins)
 *
 * Returns the raw condition objects for client-side evaluation:
 * ```json
 * {
 *   "conditions": {
 *     "assigned_if": { "field": "studentData.grade", "op": "GREATER_THAN", "value": 2 },
 *     "optional_if": { "op": "AND", "conditions": [...] }
 *   }
 * }
 * ```
 *
 * ### `assigned_if`
 * Condition that determines if the task variant is assigned to a user.
 * - When `null`: variant is assigned to **all** users in the administration
 * - When condition evaluates to `true`: variant is assigned to that user
 * - When condition evaluates to `false`: variant is NOT assigned to that user
 *
 * ### `optional_if`
 * Condition that determines if the task variant is optional for an assigned user.
 * - When `null`: variant is **required** for all assigned users
 * - When condition evaluates to `true`: variant is **optional** for that user
 * - When condition evaluates to `false`: variant is **required** for that user
 *
 * ## Supervised roles (students, guardians, parents)
 *
 * Returns the pre-evaluated result (conditions already applied server-side):
 * ```json
 * {
 *   "conditions": {
 *     "optional": false
 *   }
 * }
 * ```
 *
 * - `optional`: Boolean indicating if this task variant is optional for the current user.
 *   `false` = required, `true` = optional.
 *
 * Note: For supervised roles, variants that don't match the `assigned_if` condition
 * are filtered out entirely and won't appear in the response.
 *
 * ---
 * **Database column mapping:** The database columns `conditionsAssignment` and
 * `conditionsRequirements` map to API fields `assigned_if` and `optional_if` respectively.
 */
export const AdministrationTaskVariantConditionsSchema = z
  .object({
    // Supervisory role fields (raw conditions for client-side evaluation)
    assigned_if: ConditionSchema.nullable().optional(),
    optional_if: ConditionSchema.nullable().optional(),
    // Supervised role field (pre-evaluated result)
    optional: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const hasRawConditions = data.assigned_if !== undefined || data.optional_if !== undefined;
    const hasEvaluatedFlag = data.optional !== undefined;

    // Enforce mutual exclusivity between raw conditions and evaluated flag
    if (hasRawConditions && hasEvaluatedFlag) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Conditions must contain either raw condition fields (assigned_if/optional_if) OR the evaluated "optional" flag, not both.',
      });
    }
  });

/**
 * Task variant item for administration task variant assignments.
 * Includes nested task information for frontend display purposes.
 */
export const AdministrationTaskVariantItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  orderIndex: z.number().int(),
  task: AdministrationTaskVariantTaskSchema,
  conditions: AdministrationTaskVariantConditionsSchema,
});

export type AdministrationTaskVariantItem = z.infer<typeof AdministrationTaskVariantItemSchema>;

/**
 * Paginated response for administration task variants list.
 */
export const AdministrationTaskVariantsListResponseSchema = createPaginatedResponseSchema(
  AdministrationTaskVariantItemSchema,
);

export type AdministrationTaskVariantsListResponse = z.infer<typeof AdministrationTaskVariantsListResponseSchema>;

/**
 * Agreement version schema (current version for requested locale).
 */
export const AdministrationAgreementVersionSchema = z.object({
  id: z.string().uuid(),
  locale: LocaleSchema,
  githubFilename: z.string(),
  githubOrgRepo: z.string(),
  githubCommitSha: z.string(),
});

export type AdministrationAgreementVersion = z.infer<typeof AdministrationAgreementVersionSchema>;

/**
 * Agreement schema for administration agreement assignments.
 */
export const AdministrationAgreementSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  agreementType: AgreementTypeSchema,
  currentVersion: AdministrationAgreementVersionSchema.nullable(),
});

export type AdministrationAgreement = z.infer<typeof AdministrationAgreementSchema>;

/**
 * Allowed sort fields for administration agreements.
 */
export const ADMINISTRATION_AGREEMENT_SORT_FIELDS = ['name', 'agreementType', 'createdAt'] as const;

/**
 * Sort field type for administration agreements.
 */
export type AdministrationAgreementSortFieldType = (typeof ADMINISTRATION_AGREEMENT_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const AdministrationAgreementSortField = {
  NAME: 'name',
  AGREEMENT_TYPE: 'agreementType',
  CREATED_AT: 'createdAt',
} as const satisfies Record<string, AdministrationAgreementSortFieldType>;

/**
 * Query parameters for listing administration agreements.
 */
export const AdministrationAgreementsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ADMINISTRATION_AGREEMENT_SORT_FIELDS, 'name'),
).extend({
  locale: LocaleSchema.default('en-US'),
});

export type AdministrationAgreementsListQuery = z.infer<typeof AdministrationAgreementsListQuerySchema>;

/**
 * Paginated response for administration agreements list.
 */
export const AdministrationAgreementsListResponseSchema = createPaginatedResponseSchema(AdministrationAgreementSchema);

export type AdministrationAgreementsListResponse = z.infer<typeof AdministrationAgreementsListResponseSchema>;
