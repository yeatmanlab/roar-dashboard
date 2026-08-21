/**
 * Pure helpers for the create-organization form (`CreateOrgs.vue`).
 *
 * These are extracted from the component so the exact create-request body shape
 * for each org type — and the option lists that feed the form's dropdowns — are
 * unit-testable without mounting the component. Each `buildOrgCreateBody` return
 * value matches the corresponding `.strict()` create schema in
 * `packages/api-contract/src/v1/{districts,schools,classes,groups}/schema.ts`,
 * so unknown keys (the retired `tags` / `testData` / `demoData`) must never be
 * emitted.
 */

import { parseGooglePlaceToLocation } from '@/helpers/parseGooglePlaceToLocation';
import { ORG_TYPES } from '@/constants/orgTypes';

/**
 * Grade dropdown options for the class form.
 *
 * `value` is the backend `UserGradeSchema` value
 * (packages/api-contract/src/v1/common/user.ts), so the chosen grade can be sent
 * straight through to the create body with no later mapping. The human-readable
 * `label` is what the user sees. Grades 1–12 are sent as strings to match the
 * enum (e.g. `'1'`, not `1`).
 */
export const GRADE_OPTIONS = [
  { label: 'Pre-K', value: 'PreKindergarten' },
  { label: 'Transitional Kindergarten', value: 'TransitionalKindergarten' },
  { label: 'Kindergarten', value: 'Kindergarten' },
  { label: 'Grade 1', value: '1' },
  { label: 'Grade 2', value: '2' },
  { label: 'Grade 3', value: '3' },
  { label: 'Grade 4', value: '4' },
  { label: 'Grade 5', value: '5' },
  { label: 'Grade 6', value: '6' },
  { label: 'Grade 7', value: '7' },
  { label: 'Grade 8', value: '8' },
  { label: 'Grade 9', value: '9' },
  { label: 'Grade 10', value: '10' },
  { label: 'Grade 11', value: '11' },
  { label: 'Grade 12', value: '12' },
];

/**
 * Class type dropdown options. Values match the backend `ClassTypeSchema`
 * (`['homeroom', 'scheduled', 'other']`).
 */
export const CLASS_TYPE_OPTIONS = [
  { label: 'Homeroom', value: 'homeroom' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Other', value: 'other' },
];

/**
 * Group type dropdown options. Values match the backend `GroupTypeSchema`
 * (`['cohort', 'community', 'business']`).
 */
export const GROUP_TYPE_OPTIONS = [
  { label: 'Cohort', value: 'cohort' },
  { label: 'Community', value: 'community' },
  { label: 'Business', value: 'business' },
];

/**
 * Resolve the structured `location` object from the form's address state.
 *
 * The form's `GMapAutocomplete` stores `state.address.addressComponents` (the
 * raw Google `address_components[]`); `parseGooglePlaceToLocation` converts that
 * to the backend's flat structured `location`. Returns `undefined` when no
 * address was picked OR when parsing yields an empty object, so an empty
 * `location` is omitted from the body rather than sent as `{}`.
 *
 * @param {Object|undefined} address - The form's `state.address`.
 * @returns {Object|undefined} The structured location, or `undefined` when empty.
 */
const resolveLocation = (address) => {
  if (!address?.addressComponents) return undefined;
  const location = parseGooglePlaceToLocation(address);
  return Object.keys(location).length === 0 ? undefined : location;
};

/**
 * Build the create-request body for a given org type from the form state.
 *
 * The returned object matches the resource's `.strict()` create schema, so only
 * the fields that schema accepts are present and optional fields are omitted
 * when empty. `orgType` is the PLURAL org type (the `plural` value on each
 * `orgTypes` entry).
 *
 * Per type:
 * - districts: `{ name, abbreviation, location?, identifiers? }`
 * - schools:   `{ districtId, name, abbreviation, location?, identifiers? }`
 * - classes:   `{ schoolId, name, classType, grades? }` — NO abbreviation
 *              (the class schema has none), NO districtId (server derives it),
 *              NO location (the form collects none for classes).
 * - groups:    `{ name, abbreviation, groupType, location? }`
 *
 * @param {string} orgType - The plural org type (`districts` | `schools` | `classes` | `groups`).
 * @param {Object} state - The CreateOrgs form state.
 * @returns {Object} The create-request body for the matching create endpoint.
 * @throws {Error} If the org type is not creatable via this form.
 */
export const buildOrgCreateBody = (orgType, state) => {
  const name = state.orgName;
  const abbreviation = state.orgInitials;
  const location = resolveLocation(state.address);
  const identifiers = state.ncesId ? { ncesId: state.ncesId } : undefined;

  switch (orgType) {
    case ORG_TYPES.DISTRICTS:
      return {
        name,
        abbreviation,
        ...(location ? { location } : {}),
        ...(identifiers ? { identifiers } : {}),
      };

    case ORG_TYPES.SCHOOLS:
      return {
        districtId: state.parentDistrict.id,
        name,
        abbreviation,
        ...(location ? { location } : {}),
        ...(identifiers ? { identifiers } : {}),
      };

    case ORG_TYPES.CLASSES:
      return {
        schoolId: state.parentSchool.id,
        name,
        classType: state.classType,
        // `state.grade` is the schema string value directly (the grade select uses
        // `option-value="value"`, matching classType/groupType).
        ...(state.grade ? { grades: [state.grade] } : {}),
      };

    case ORG_TYPES.GROUPS:
      return {
        name,
        abbreviation,
        groupType: state.groupType,
        ...(location ? { location } : {}),
      };

    default:
      throw new Error(`Unsupported org type for create: ${orgType}`);
  }
};
