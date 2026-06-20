/**
 * Mapping helpers that adapt the backend org detail shapes
 * (`DistrictDetailSchema` / `SchoolDetailSchema` from `@roar-platform/api-contract`)
 * to the flat org shape the dashboard consumers historically read from the
 * legacy Firestore documents.
 *
 * The backend nests address fields under `location` and external identifiers
 * (MDR / NCES / state) under `identifiers`. The legacy Firestore documents
 * exposed those as flat top-level fields, so these helpers flatten them to keep
 * existing consumers (OrgPicker, OrgsList, ProgressReport, ScoreReport,
 * CreateOrgs) working without edits.
 *
 * @TODO Some legacy fields are not yet provided by the backend org schemas and
 * therefore cannot be mapped here:
 *   - districts: `clever` (ScoreReport adds a "State ID" CSV column when
 *     `clever === true`; absent → column is simply omitted, which is the
 *     correct default for non-Clever orgs).
 *   - schools: `lowGrade` (ScoreReport derives a per-school grade label from it,
 *     falling back to grade 0 when absent). NOTE: not derivable from the school
 *     detail shape — `grades` lives on the class sub-resource, not the school.
 *   - districts/schools: `tags` (CreateOrgs builds the Tags autocomplete
 *     suggestion list from district tags; absent → suggestions are empty, though
 *     users can still type tags freely).
 * These degrade gracefully (optional reads with fallbacks) rather than throwing.
 * Re-map them here once the backend exposes them on the org detail schemas.
 */

/**
 * Flatten a backend `location` object onto a flat org record.
 *
 * @param {Object|undefined} location - The backend `location` object, if present.
 * @returns {Object} The flattened address fields (empty when location is absent).
 */
const flattenLocation = (location) => {
  if (!location) return {};
  return {
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2,
    city: location.city,
    stateProvince: location.stateProvince,
    postalCode: location.postalCode,
    country: location.country,
  };
};

/**
 * Flatten a backend `identifiers` object onto a flat org record.
 *
 * @param {Object|undefined} identifiers - The backend `identifiers` object, if present.
 * @returns {Object} The flattened identifier fields (empty when identifiers are absent).
 */
const flattenIdentifiers = (identifiers) => {
  if (!identifiers) return {};
  return {
    mdrNumber: identifiers.mdrNumber,
    ncesId: identifiers.ncesId,
    stateId: identifiers.stateId,
    schoolNumber: identifiers.schoolNumber,
  };
};

/**
 * Map a backend district detail object to the flat org shape consumers read.
 *
 * Preserves the raw fields (`id`, `name`, `abbreviation`, `orgType`,
 * `parentOrgId`, etc.) and additionally flattens `location` and `identifiers`
 * to top-level fields.
 *
 * @param {Object} district - A `DistrictDetailSchema` object from the backend.
 * @returns {Object} The flattened district record.
 */
export const mapDistrictToOrg = (district) => ({
  ...district,
  ...flattenLocation(district.location),
  ...flattenIdentifiers(district.identifiers),
});

/**
 * Map a backend school detail object to the flat org shape consumers read.
 *
 * Preserves the raw fields (`id`, `name`, `abbreviation`, `orgType`,
 * `parentOrgId`, etc.) and additionally flattens `location` and `identifiers`
 * to top-level fields.
 *
 * @param {Object} school - A `SchoolDetailSchema` object from the backend.
 * @returns {Object} The flattened school record.
 */
export const mapSchoolToOrg = (school) => ({
  ...school,
  ...flattenLocation(school.location),
  ...flattenIdentifiers(school.identifiers),
});
