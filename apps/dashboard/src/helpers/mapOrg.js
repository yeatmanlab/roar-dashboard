/**
 * Mapping helpers that adapt the backend org shapes
 * (`DistrictDetailSchema` / `SchoolDetailSchema` / `SchoolClassSchema` from
 * `@roar-platform/api-contract`) to the flat org shape the dashboard consumers
 * historically read from the legacy Firestore documents.
 *
 * For districts and schools the backend nests address fields under `location`
 * and external identifiers (MDR / NCES / state) under `identifiers`. The legacy
 * Firestore documents exposed those as flat top-level fields, so these helpers
 * flatten them to keep existing consumers (OrgPicker, OrgsList, ProgressReport,
 * ScoreReport, CreateOrgs) working without edits.
 *
 * The class shape (`SchoolClassSchema`, returned by
 * `GET /schools/:schoolId/classes`) is already flat — `mapClassToOrg` exists
 * for parity with the district/school mappers and as the single place to adapt
 * the class shape if consumer expectations diverge from the backend.
 *
 * @TODO Some legacy fields are not yet provided by the backend org schemas and
 * therefore cannot be mapped here:
 *   - districts: `clever` (ScoreReport adds "Student ID"/"State ID" CSV columns
 *     when `clever === true`; absent → columns are simply omitted, which is the
 *     correct default for non-Clever orgs). The same `orgData.clever` read also
 *     fires when the report org is a school, so this gap affects schools too.
 *   - schools: `lowGrade` (ScoreReport derives a per-school grade label from it,
 *     falling back to grade 0 when absent). NOTE: not derivable from the school
 *     detail shape — `grades` lives on the class sub-resource, not the school.
 *   - districts/schools: `tags` (CreateOrgs builds the Tags autocomplete
 *     suggestion list from district tags; absent → suggestions are empty, though
 *     users can still type tags freely).
 *   - classes: `tags` (CreateOrgs also folds class `tags` into the same Tags
 *     autocomplete suggestion list (CreateOrgs.vue:341); `SchoolClassSchema`
 *     has no `tags` field, so class tags contribute nothing to the suggestions.
 *     Users can still type tags freely — autocomplete-only, no data loss).
 * These degrade gracefully (optional reads with fallbacks) rather than throwing.
 * Re-map them here once the backend exposes them on the org schemas.
 */

/**
 * Flatten a backend `location` object onto a flat org record.
 *
 * @param {Object|undefined} location - The backend `location` object, if present.
 * @returns {Object} The flattened address fields (empty when location is absent).
 */
const flattenLocation = (location) => {
  if (!location) return {};
  return Object.fromEntries(
    ['addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country']
      .filter((key) => Object.hasOwn(location, key) && location[key] !== undefined)
      .map((key) => [key, location[key]]),
  );
};

/**
 * Flatten a backend `identifiers` object onto a flat org record.
 *
 * @param {Object|undefined} identifiers - The backend `identifiers` object, if present.
 * @returns {Object} The flattened identifier fields (empty when identifiers are absent).
 */
const flattenIdentifiers = (identifiers) => {
  if (!identifiers) return {};
  return Object.fromEntries(
    ['mdrNumber', 'ncesId', 'stateId', 'schoolNumber']
      .filter((key) => Object.hasOwn(identifiers, key) && identifiers[key] !== undefined)
      .map((key) => [key, identifiers[key]]),
  );
};

/**
 * Map a backend district detail object to the flat org shape consumers read.
 *
 * Keeps the scalar fields (`id`, `name`, `abbreviation`, `orgType`,
 * `parentOrgId`, etc.) and replaces the nested `location` and `identifiers`
 * objects with their flattened top-level fields. The nested objects are
 * destructured out so the result carries a single (flat) representation rather
 * than both; `location.coordinates` is intentionally not surfaced (no consumer
 * reads it).
 *
 * @param {Object} district - A `DistrictDetailSchema` object from the backend.
 * @returns {Object} The flattened district record.
 */
export const mapDistrictToOrg = ({ location, identifiers, ...rest }) => ({
  ...rest,
  ...flattenLocation(location),
  ...flattenIdentifiers(identifiers),
});

/**
 * Map a backend school detail object to the flat org shape consumers read.
 *
 * Keeps the scalar fields (`id`, `name`, `abbreviation`, `orgType`,
 * `parentOrgId`, etc.) and replaces the nested `location` and `identifiers`
 * objects with their flattened top-level fields. The nested objects are
 * destructured out so the result carries a single (flat) representation rather
 * than both; `location.coordinates` is intentionally not surfaced (no consumer
 * reads it).
 *
 * @param {Object} school - A `SchoolDetailSchema` object from the backend.
 * @returns {Object} The flattened school record.
 */
export const mapSchoolToOrg = ({ location, identifiers, ...rest }) => ({
  ...rest,
  ...flattenLocation(location),
  ...flattenIdentifiers(identifiers),
});

/**
 * Map a backend school-class object to the flat org shape consumers read.
 *
 * `SchoolClassSchema` (from `GET /schools/:schoolId/classes`) is already flat,
 * so this preserves its raw fields (`id`, `name`, `schoolId`, `districtId`,
 * `classType`, `grades`, `courseId`, `number`, `period`, `subjects`,
 * `schoolLevels`, `createdAt`, `updatedAt`) unchanged. It exists for parity
 * with `mapDistrictToOrg` / `mapSchoolToOrg` and as the single seam to adapt
 * the class shape should consumer expectations diverge from the backend.
 *
 * @param {Object} schoolClass - A `SchoolClassSchema` object from the backend.
 * @returns {Object} The class record in the flat org shape.
 */
export const mapClassToOrg = (schoolClass) => ({
  ...schoolClass,
});
