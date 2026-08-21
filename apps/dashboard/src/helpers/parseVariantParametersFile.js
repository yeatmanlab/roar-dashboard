import { TASK_PARAMETER_TYPES } from '@/constants/tasks';

/** The parameter data types the configurator (and this importer) accept. */
const ALLOWED_TYPES = Object.values(TASK_PARAMETER_TYPES); // ['string', 'number', 'boolean']

/**
 * Parse and validate an uploaded variant-parameters JSON file into configurator rows.
 *
 * The expected file is a JSON **array** of `{ name, type, value }` objects, where:
 * - `name` is a non-empty string,
 * - `type` is one of `TASK_PARAMETER_TYPES` (`'string' | 'number' | 'boolean'`), and
 * - `value`'s JS `typeof` matches `type` (so `type: 'number'` requires a numeric `value`).
 *
 * Each entry is mapped to the same row shape the `TaskParametersConfigurator` produces
 * (`{ name, type, value, isNew: true }`), so callers can splice the result straight into the
 * form's `paramsModel`. An empty array yields `[]`. Any structural or type error throws an
 * `Error` with a human-readable message suitable for a toast.
 *
 * @param {string} text - The raw file contents (e.g. from `FileReader.readAsText`).
 * @returns {Array<{ name: string, type: string, value: (string|number|boolean), isNew: boolean }>}
 *   Validated configurator rows.
 * @throws {Error} On invalid JSON, a non-array top level, or any invalid entry.
 */
export function parseVariantParametersJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      'Expected a JSON array of parameters, e.g. [{ "name": "numberOfTrials", "type": "number", "value": 30 }].',
    );
  }

  return parsed.map((entry, index) => {
    const label = `Parameter ${index + 1}`;

    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${label}: each entry must be an object with "name", "type", and "value".`);
    }

    const { name, type, value } = entry;

    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(`${label}: "name" must be a non-empty string.`);
    }
    if (!ALLOWED_TYPES.includes(type)) {
      throw new Error(`${label}: "type" must be one of ${ALLOWED_TYPES.join(', ')}.`);
    }
    // The allowed types are exactly the `typeof` results we accept, so a direct
    // comparison enforces that the value matches its declared type.
    if (typeof value !== type) {
      throw new Error(`${label}: "value" must be a ${type} to match its declared type.`);
    }

    return { name: name.trim(), type, value, isNew: true };
  });
}
