import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';
import { BCP47_LOCALE } from '../common/regex';

/**
 * BCP-47 locale code schema.
 * Validates ISO 639-1 language code with optional ISO 3166-1 region code.
 * Examples: "en", "en-US", "es", "es-MX"
 */
export const LocaleSchema = z
  .string()
  .max(5)
  .regex(BCP47_LOCALE, 'Invalid locale format. Expected BCP-47 format (e.g., "en", "en-US", "es-MX")');

export type Locale = z.infer<typeof LocaleSchema>;

/**
 * Agreement type values.
 * - tos: Terms of Service
 * - assent: Minor's agreement (typically for students)
 * - consent: Guardian/parent consent
 */
export const AGREEMENT_TYPE_VALUES = ['tos', 'assent', 'consent'] as const;

/**
 * Schema for agreement type.
 * Must stay in sync with the backend agreementTypeEnum — verified by agreement-type.enum.test.ts.
 */
export const AgreementTypeSchema = z.enum(AGREEMENT_TYPE_VALUES);

export type AgreementType = z.infer<typeof AgreementTypeSchema>;

/**
 * Agreement version base schema.
 * Represents a single version of an agreement with GitHub content references.
 * Document content is NOT included — only the metadata needed to fetch it from GitHub.
 */
export const AgreementVersionBaseSchema = z.object({
  id: z.string().uuid(),
  locale: LocaleSchema,
  githubFilename: z.string(),
  githubOrgRepo: z.string(),
  githubCommitSha: z.string(),
  createdAt: z.string().datetime(),
});

export type AgreementVersionBase = z.infer<typeof AgreementVersionBaseSchema>;

/**
 * Agreement base schema (without embedded data).
 * updatedAt is nullable — it is only set on UPDATE, not on INSERT.
 */
export const AgreementBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  agreementType: AgreementTypeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export type AgreementBase = z.infer<typeof AgreementBaseSchema>;

/**
 * Full agreement schema with optional embedded data.
 *
 * Always includes currentVersion for the requested locale (null if no current version
 * exists for that locale, though this should not occur in production).
 *
 * When ?embed=versions is requested, also includes all versions (current and historical)
 * across all locales, sorted by createdAt descending.
 */
export const AgreementSchema = AgreementBaseSchema.extend({
  currentVersion: AgreementVersionBaseSchema.nullable(),
  versions: z.array(AgreementVersionBaseSchema).optional(),
});

export type Agreement = z.infer<typeof AgreementSchema>;

/**
 * Allowed sort fields for agreements.
 */
export const AGREEMENT_SORT_FIELDS = ['name', 'agreementType', 'createdAt', 'updatedAt'] as const;

/**
 * Sort field type for agreements.
 */
export type AgreementSortFieldType = (typeof AGREEMENT_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const AgreementSortField = {
  NAME: 'name',
  AGREEMENT_TYPE: 'agreementType',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const satisfies Record<string, AgreementSortFieldType>;

/**
 * Allowed embed options for agreements.
 * - 'versions': Include all versions (current and historical) for each agreement
 */
export const AGREEMENT_EMBED_OPTIONS = ['versions'] as const;

/**
 * Embed option type for agreements.
 */
export type AgreementEmbedOptionType = (typeof AGREEMENT_EMBED_OPTIONS)[number];

/**
 * Embed option constants for type-safe access.
 */
export const AgreementEmbedOption = {
  VERSIONS: 'versions',
} as const satisfies Record<string, AgreementEmbedOptionType>;

/**
 * Query parameters for listing agreements.
 */
export const AgreementsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(AGREEMENT_SORT_FIELDS, 'createdAt'),
)
  .merge(createEmbedQuerySchema(AGREEMENT_EMBED_OPTIONS))
  .extend({
    agreementType: AgreementTypeSchema.optional(),
    locale: LocaleSchema.default('en-US'),
  });

export type AgreementsListQuery = z.infer<typeof AgreementsListQuerySchema>;

/**
 * Paginated response for agreements list.
 */
export const AgreementsListResponseSchema = createPaginatedResponseSchema(AgreementSchema);

export type AgreementsListResponse = z.infer<typeof AgreementsListResponseSchema>;

/**
 * Path parameters for fetching a single agreement version's content.
 */
export const AgreementVersionContentParamsSchema = z.object({
  agreementId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export type AgreementVersionContentParams = z.infer<typeof AgreementVersionContentParamsSchema>;

/**
 * Agreement version content response.
 * Includes the raw markdown content fetched from GitHub alongside version metadata.
 */
export const AgreementVersionContentSchema = z.object({
  id: z.string().uuid(),
  agreementId: z.string().uuid(),
  locale: LocaleSchema,
  content: z.string(),
  githubCommitSha: z.string(),
  createdAt: z.string().datetime(),
});

export type AgreementVersionContent = z.infer<typeof AgreementVersionContentSchema>;
