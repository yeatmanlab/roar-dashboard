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
