export const TASK_PARAMETER_TYPES = Object.freeze({
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
});

export const TASK_PARAMETER_DEFAULT_SHAPE = {
  name: '',
  value: '',
  type: TASK_PARAMETER_TYPES.STRING,
};

/**
 * Task field constraints, mirroring the API contract's CreateTaskRequestBodySchema
 * (packages/api-contract/src/v1/tasks/schema.ts) so forms can validate inline
 * instead of surfacing backend 400s.
 */
export const TASK_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const TASK_SLUG_MAX_LENGTH = 32;
export const TASK_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_\- ]*$/;
export const TASK_NAME_MAX_LENGTH = 255;
export const TASK_DESCRIPTION_MAX_LENGTH = 1024;

/**
 * Task *variant* parameter name constraints, mirroring the API contract's
 * TaskVariantParameterSchema (packages/api-contract/src/v1/tasks/schema.ts), which applies
 * IDENTIFIER_WITH_UNDERSCORES server-side. Unlike taskConfig keys below, these are enforced
 * by the backend, so a violation is a 400 rather than a style problem.
 *
 * Deliberately separate from TASK_PARAMETER_NAME_REGEX below despite being identical today:
 * that one is a UI-only convention for taskConfig keys and may be relaxed without touching
 * the contract. Sharing it would silently relax this one too.
 */
export const TASK_VARIANT_PARAMETER_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;
export const TASK_VARIANT_PARAMETER_NAME_MAX_LENGTH = 255;

/**
 * UI-only constraint on newly created taskConfig parameter names. Applied only to NEW
 * rows — existing backend keys are unconstrained server-side and must remain
 * loadable/editable as-is.
 *
 * NOTE: not a contract mirror. The contract's IDENTIFIER_WITH_UNDERSCORES constrains
 * task *variant* parameter names (TaskVariantParameterSchema), not taskConfig keys,
 * which are arbitrary JSON object keys with no server-side format constraint. This
 * regex is purely a form-level guard against junk key names on new rows.
 */
export const TASK_PARAMETER_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Task variant publication statuses, mirroring the contract's TaskVariantStatusSchema.
 */
export const TASK_VARIANT_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  DEPRECATED: 'deprecated',
});
