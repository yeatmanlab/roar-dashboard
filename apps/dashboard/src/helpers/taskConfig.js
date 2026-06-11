import { TASK_PARAMETER_TYPES } from '@/constants/tasks';

/**
 * Helpers for converting a task's `taskConfig` object to and from the
 * row-based shape edited by `TaskParametersConfigurator`.
 *
 * Keys are preserved **verbatim** in both directions. The legacy
 * `convertParamArrayToObject` helper camelCases keys, which silently rewrites
 * any non-camelCase key on every round-trip (e.g. `max_attempts` →
 * `maxAttempts`) — corrupting existing backend `taskConfig` data and defeating
 * change detection. New keys are format-validated at the form layer instead.
 */

const EDITABLE_VALUE_TYPES = Object.values(TASK_PARAMETER_TYPES);

/**
 * Checks whether a taskConfig value can be edited in the configurator.
 *
 * @param {*} value – The taskConfig entry value.
 * @returns {Boolean} true for string, number, and boolean values.
 */
export function isEditableTaskConfigValue(value) {
  return EDITABLE_VALUE_TYPES.includes(typeof value);
}

/**
 * Split a task's `taskConfig` into configurator rows and passthrough entries.
 *
 * Scalar entries (string/number/boolean) become editable rows. Everything
 * else — `null`, arrays, nested objects — is returned as `passthrough` so it
 * can be merged back verbatim on submit; the contract explicitly allows such
 * values and the row editor cannot represent them.
 *
 * @param {*} taskConfig – The task's taskConfig value (jsonb, may be anything).
 * @returns {{ editableRows: Array<Object>, passthrough: Object, canEdit: Boolean }}
 *   `canEdit` is false when taskConfig is not a plain object (e.g. an array),
 *   in which case the editor should be disabled entirely.
 */
export function splitTaskConfig(taskConfig) {
  if (taskConfig === null || taskConfig === undefined) {
    return { editableRows: [], passthrough: {}, canEdit: true };
  }

  if (typeof taskConfig !== 'object' || Array.isArray(taskConfig)) {
    return { editableRows: [], passthrough: {}, canEdit: false };
  }

  const editableRows = [];
  const passthrough = {};

  for (const [name, value] of Object.entries(taskConfig)) {
    if (isEditableTaskConfigValue(value)) {
      editableRows.push({ name, value, type: typeof value });
    } else {
      passthrough[name] = value;
    }
  }

  return { editableRows, passthrough, canEdit: true };
}

/**
 * Build a `taskConfig` object from configurator rows and passthrough entries.
 *
 * Row names are used verbatim as keys (no camelCasing — see module JSDoc).
 * Rows with a blank name are skipped. Passthrough entries are merged first so
 * an edited row can never be silently shadowed by a preserved entry.
 *
 * @param {Array<Object>} rows – The configurator rows ({ name, value, type }).
 * @param {Object} [passthrough={}] – Non-editable entries preserved from the original.
 * @returns {Object} The combined taskConfig object.
 */
export function buildTaskConfigFromRows(rows, passthrough = {}) {
  const config = { ...passthrough };

  for (const row of rows) {
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) continue;
    config[name] = row.value;
  }

  return config;
}
