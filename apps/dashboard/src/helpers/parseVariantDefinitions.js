import {
  TASK_PARAMETER_TYPES,
  TASK_NAME_REGEX,
  TASK_NAME_MAX_LENGTH,
  TASK_VARIANT_PARAMETER_NAME_REGEX,
  TASK_VARIANT_PARAMETER_NAME_MAX_LENGTH,
  TASK_VARIANT_STATUSES,
} from '@/constants/tasks';

/** The parameter data types the configurator (and this importer) accept. */
const ALLOWED_TYPES = Object.values(TASK_PARAMETER_TYPES); // ['string', 'number', 'boolean']

/** The publication statuses a definition may declare. Mirrors the contract's enum. */
const ALLOWED_STATUSES = Object.values(TASK_VARIANT_STATUSES); // ['draft', 'published', 'deprecated']

/**
 * Convert one variant's `params` object into configurator rows.
 *
 * The row shape matches what `TaskParametersConfigurator` produces
 * (`{ name, type, value, isNew: true }`), so callers can splice the result straight into the
 * form's `paramsModel`.
 *
 * `type` is not present in the file and is not part of the API contract either — the
 * contract takes `{ name, value }` (see `packages/api-contract/src/v1/tasks/schema.ts`).
 * It exists only so the configurator can render the right input, so it is inferred from the
 * value via `typeof`, which is exactly what `ALLOWED_TYPES` enumerates.
 *
 * A kept parameter's name is validated against the contract's rule for variant parameter names,
 * for the same reason `variantName` is: the backend enforces it, and reporting it against the file
 * beats an opaque 400 at submit time. Dropped parameters are not name-checked — they never reach
 * the API, so their keys cannot fail there.
 *
 * Null and undefined values are dropped rather than imported: a parameter with no value is not
 * a configuration choice, and the platform stores only parameters with explicit values. Empty
 * objects and arrays are dropped on the same grounds — they carry no configuration and the
 * configurator has no way to represent them. A *non-empty* object or array is rejected instead,
 * since dropping real configuration silently would be worse than refusing the input.
 *
 * @param {object} params - The variant's `params` object from the file
 * @param {string} label - Prefix for error messages
 * @returns {Array<{ name: string, type: string, value: (string|number|boolean), isNew: boolean }>}
 * @throws {Error} If a parameter name is one the API would reject, or a value's type cannot be
 *   represented by the configurator
 */
function toConfiguratorRows(params, label) {
  const rows = [];

  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object') {
      const isEmptyContainer = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
      if (isEmptyContainer) continue;
      throw new Error(
        `${label}: parameter "${name}" is a nested ${Array.isArray(value) ? 'array' : 'object'}, ` +
          `which the parameter configurator cannot represent. Remove it or flatten it before importing.`,
      );
    }

    if (name.length > TASK_VARIANT_PARAMETER_NAME_MAX_LENGTH) {
      throw new Error(
        `${label}: parameter name "${name}" must be ${TASK_VARIANT_PARAMETER_NAME_MAX_LENGTH} characters or fewer.`,
      );
    }

    // Mirrors the contract's IDENTIFIER_WITH_UNDERSCORES rule on variant parameter names.
    if (!TASK_VARIANT_PARAMETER_NAME_REGEX.test(name)) {
      throw new Error(
        `${label}: parameter name "${name}" must start with a letter and contain only letters, ` +
          `numbers, and underscores.`,
      );
    }

    const type = typeof value;
    if (!ALLOWED_TYPES.includes(type)) {
      throw new Error(
        `${label}: parameter "${name}" has an unsupported type (${type}). Expected one of ${ALLOWED_TYPES.join(', ')}.`,
      );
    }

    rows.push({ name, type, value, isNew: true });
  }

  return rows;
}

/**
 * The `params` keys that determine which task a variant belongs to.
 *
 * An assessment's variants are distributed across its tasks by these parameters: language
 * variants are selected by `lng` or `language`, and multi-task assessments select by `task` or
 * `taskName`. The form does not resolve a task from parameters itself, and does not need to:
 * whatever the mapping is, entries agreeing on every one of these keys resolve to the same
 * task, and entries that disagree may not.
 *
 * If an assessment ever distributes its variants by a different parameter, it must be added
 * here too, or a cross-task upload would pass the check below.
 */
const TASK_ROUTING_PARAM_KEYS = ['language', 'lng', 'task', 'taskName'];

/**
 * Assert every entry in a multi-variant file belongs to the same task.
 *
 * The form creates under a single selected task, so a file spanning several tasks would
 * silently produce variants attached to the wrong one. Rather than guess, reject and name the
 * key that differs.
 *
 * @param {Array<{ variantName: string, params: object }>} entries - Raw file entries
 * @throws {Error} If any routing key holds different values across entries
 */
function assertSingleTask(entries) {
  for (const key of TASK_ROUTING_PARAM_KEYS) {
    const values = new Set(entries.map((entry) => JSON.stringify((entry.params ?? {})[key] ?? null)));
    if (values.size > 1) {
      const rendered = [...values].map((v) => JSON.parse(v)).map((v) => (v === null ? '(unset)' : v));
      throw new Error(
        `This file's variants belong to different tasks — "${key}" varies across them (${rendered.join(', ')}). ` +
          `The form creates variants for one task at a time, so upload only the entries for a single task.`,
      );
    }
  }
}

/**
 * Assert no two definitions claim the same variant name.
 *
 * `task_variants_task_name_unique_idx` is unique on `(taskId, lower(name))`, so within the one
 * task this upload targets a repeated name is not merely redundant — it is unsatisfiable, and the
 * second create is guaranteed to conflict.
 *
 * Left unchecked it also loses data silently: the form tracks created names case-insensitively,
 * so creating the first of two identically-named definitions drops *both* from the picker, and
 * the second is never attempted. (The batch path does attempt both, but reports the result as a
 * conflict, which reads as "this variant already exists" rather than "your file names it twice".)
 *
 * Runs on validated, trimmed names so that a per-entry problem is reported as itself rather than
 * as a spurious duplicate.
 *
 * @param {Array<{ variantName: string }>} definitions - Parsed definitions
 * @throws {Error} If two or more definitions share a name, ignoring case and surrounding space
 */
function assertNoDuplicateNames(definitions) {
  const byKey = new Map();
  for (const { variantName } of definitions) {
    const key = variantName.toLowerCase();
    byKey.set(key, [...(byKey.get(key) ?? []), variantName]);
  }

  for (const spellings of byKey.values()) {
    if (spellings.length < 2) continue;

    const distinct = [...new Set(spellings)];
    const found =
      distinct.length === 1
        ? `${spellings.length} variants named "${distinct[0]}"`
        : `${spellings.length} variants whose names differ only by case: ${distinct.map((n) => `"${n}"`).join(', ')}`;

    throw new Error(
      `This file has ${found}. A task cannot have two variants with the same name, so upload one ` +
        `of them or rename the others.`,
    );
  }
}

/**
 * Parse and validate uploaded task-variant definitions.
 *
 * Accepts one or more variant definitions, either bare or wrapped in an array:
 *
 * ```json
 * [{ "variantName": "English-v7", "status": "published", "params": { "language": "en" } }]
 * ```
 *
 * `status` is optional. When a definition declares one it is validated against the contract's
 * enum and returned; when it does not, `status` is absent from the result and the caller supplies
 * it from the form. Every created variant therefore has a status either way — the contract
 * requires the field, so it cannot be omitted from a create request. Declaring it per definition
 * exists for the batch case, where one form selection would otherwise apply to every variant in
 * the file.
 *
 * **All entries must belong to the same task.** A variant's task is *implicit* in its `params`
 * rather than named, and this form creates under a single selected task — so a batch spanning
 * tasks would silently attach variants to the wrong one. Language variants in particular look
 * near-identical apart from one parameter. {@link assertSingleTask} rejects a cross-task batch;
 * several variants of one task are accepted together.
 *
 * `variantName` and every kept parameter name are validated against the rules the API enforces,
 * so a name the API would reject is reported against the file rather than surfacing as a backend
 * 400 after the form is filled in.
 *
 * @param {string} text - The raw file contents (e.g. from `FileReader.readAsText`).
 * @returns {Array<{ variantName: string, status?: string, rows: Array<{ name: string, type: string, value: (string|number|boolean), isNew: boolean }> }>}
 *   One entry per variant, in file order, each with its configurator rows and, when the
 *   definition declared one, its status.
 * @throws {Error} On invalid JSON, a cross-task file, a repeated variant name, or any invalid
 *   field.
 */
export function parseVariantDefinitions(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  const entries = Array.isArray(parsed) ? parsed : [parsed];

  if (entries.length === 0) {
    throw new Error('The file contains no variants.');
  }

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Each variant must be an object with "variantName" and "params".');
    }
  }

  if (entries.length > 1) {
    assertSingleTask(entries);
  }

  const definitions = entries.map(({ variantName, params, status }, index) => {
    const label = entries.length > 1 ? `Variant ${index + 1}` : 'Variant';

    if (typeof variantName !== 'string' || variantName.trim() === '') {
      throw new Error(`${label}: "variantName" must be a non-empty string.`);
    }

    const trimmedName = variantName.trim();

    if (trimmedName.length > TASK_NAME_MAX_LENGTH) {
      throw new Error(`${label}: "variantName" must be ${TASK_NAME_MAX_LENGTH} characters or fewer.`);
    }

    // Mirrors the API contract's IDENTIFIER_WITH_SPACES rule.
    if (!TASK_NAME_REGEX.test(trimmedName)) {
      throw new Error(
        `${label}: "variantName" (${trimmedName}) must start with a letter and contain only letters, ` +
          `numbers, spaces, hyphens, and underscores.`,
      );
    }

    // A definition may declare its own status. Absent, the caller's selection applies — see the
    // returned shape below.
    let declaredStatus;
    if (status !== undefined && status !== null) {
      if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status.trim())) {
        throw new Error(`${label}: "status" must be one of ${ALLOWED_STATUSES.join(', ')}.`);
      }
      declaredStatus = status.trim();
    }

    if (params === null || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error(`${label}: "params" must be an object of parameter names to values.`);
    }

    return {
      variantName: trimmedName,
      ...(declaredStatus ? { status: declaredStatus } : {}),
      rows: toConfiguratorRows(params, label),
    };
  });

  assertNoDuplicateNames(definitions);

  return definitions;
}
