/**
 * Mapping helpers that adapt the backend org shapes
 * (`DistrictDetailSchema` / `SchoolDetailSchema` / `SchoolClassSchema` /
 * `GroupDetailSchema` / `ClassDetailSchema` from `@roar-platform/api-contract`)
 * to the flat org shape the dashboard consumers historically read from the
 * legacy Firestore documents.
 *
 * For districts and schools the backend nests address fields under `location`
 * and external identifiers (MDR / NCES / state) under `identifiers`. The legacy
 * Firestore documents exposed those as flat top-level fields, so these helpers
 * flatten them to keep existing consumers (OrgPicker, OrgsList, ProgressReport,
 * ScoreReport, CreateOrgs) working without edits.
 *
 * Groups (`GroupDetailSchema`, from `GET /groups` and `GET /groups/:groupId`)
 * nest address fields under `location` too, but have NO `identifiers` and no
 * external SSO flags. `mapGroupToOrg` flattens `location` only.
 *
 * The class shapes are already flat. `SchoolClassSchema`
 * (`GET /schools/:schoolId/classes`) and `ClassDetailSchema`
 * (`GET /classes/:classId`) both expose scalar columns at the top level; the
 * latter adds a `location` string (a room/location label, not an assembled
 * address object) and `rosteringEnded`, both of which pass through the spread
 * unchanged. A single `mapClassToOrg` therefore covers both shapes — see its
 * JSDoc for the field-level comparison.
 *
 * @TODO Some legacy fields are not yet provided by the backend org schemas and
 * therefore cannot be mapped here:
 *   - districts: `clever` (ScoreReport adds "Student ID"/"State ID" CSV columns
 *     when `clever === true`; absent → columns are simply omitted, which is the
 *     correct default for non-Clever orgs). The same `orgData.clever` read
 *     (ScoreReport.vue:1583) fires for whatever org type the report is rendered
 *     for — schools, and now groups and classes too, since `useOrgQuery` routes
 *     all of them to ScoreReport. None of `SchoolDetailSchema`,
 *     `GroupDetailSchema`, or `ClassDetailSchema` carries a `clever` flag, so
 *     this gap spans districts, schools, groups, and classes. Effect is
 *     identical everywhere: the two Clever-only CSV columns are omitted, which
 *     is the correct default for non-Clever orgs.
 *   - schools: `lowGrade` (ScoreReport derives a per-school grade label from it,
 *     falling back to grade 0 when absent). NOTE: not derivable from the school
 *     detail shape — `grades` lives on the class sub-resource, not the school.
 *   - districts/schools: `tags` (CreateOrgs builds the Tags autocomplete
 *     suggestion list from district tags; absent → suggestions are empty, though
 *     users can still type tags freely).
 *   - groups: `tags` (CreateOrgs also folds group `tags` into the same Tags
 *     autocomplete suggestion list (CreateOrgs.vue:342); `GroupDetailSchema`
 *     has no `tags` field, so group tags contribute nothing to the suggestions.
 *     Users can still type tags freely — autocomplete-only, no data loss).
 *   - classes: `tags` (CreateOrgs also folds class `tags` into the same Tags
 *     autocomplete suggestion list (CreateOrgs.vue:341); neither
 *     `SchoolClassSchema` nor `ClassDetailSchema` has a `tags` field, so class
 *     tags contribute nothing to the suggestions. Note that the CreateOrgs read
 *     is fed by `useSchoolClassesQuery`, not the by-id `useClassesQuery` mapped
 *     here. Users can still type tags freely — autocomplete-only, no data loss).
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
 * Map a backend group detail object to the flat org shape consumers read.
 *
 * Keeps the scalar fields (`id`, `name`, `abbreviation`, `groupType`,
 * `rosteringEnded`, etc.) and replaces the nested `location` object with its
 * flattened top-level fields (the nested object is destructured out so the
 * result carries a single flat representation). Unlike districts and schools,
 * groups are flat standalone entities — `GroupDetailSchema` has no `identifiers`
 * block (no MDR/NCES/state ids) and no `orgType`/`parentOrgId` — so there is
 * nothing else to flatten.
 *
 * @param {Object} group - A `GroupDetailSchema` object from the backend.
 * @returns {Object} The flattened group record.
 */
export const mapGroupToOrg = ({ location, ...rest }) => ({
  ...rest,
  ...flattenLocation(location),
});

/**
 * Map a backend class object to the flat org shape consumers read.
 *
 * Both backend class shapes are already flat, so this preserves their raw
 * fields unchanged and exists for parity with the other org mappers and as the
 * single seam to adapt the class shape should consumer expectations diverge
 * from the backend.
 *
 * Covers two shapes:
 *   - `SchoolClassSchema` (`GET /schools/:schoolId/classes`):
 *     `id`, `name`, `schoolId`, `districtId`, `classType`, `grades`,
 *     `courseId`, `number`, `period`, `subjects`, `schoolLevels`, `createdAt`,
 *     `updatedAt`.
 *   - `ClassDetailSchema` (`GET /classes/:classId`, the by-id read mapped by
 *     `useClassesQuery`): the same flat core (`id`, `name`, `schoolId`,
 *     `districtId`, `classType`, `courseId`, `number`, `period`, `subjects`,
 *     `grades`, `schoolLevels`) plus a `location` string (a free-text
 *     room/location label — NOT an assembled address object, so it needs no
 *     flattening) and `rosteringEnded`. It omits `createdAt`/`updatedAt`.
 *
 * Because every field on both shapes is a top-level scalar/array (the lone
 * `location` is a plain string, not a nested `{ city, ... }` object), the
 * spread alone yields the correct flat record for either shape — no dedicated
 * detail mapper is needed.
 *
 * @param {Object} schoolClass - A `SchoolClassSchema` or `ClassDetailSchema` object.
 * @returns {Object} The class record in the flat org shape.
 */
export const mapClassToOrg = (schoolClass) => ({
  ...schoolClass,
});
