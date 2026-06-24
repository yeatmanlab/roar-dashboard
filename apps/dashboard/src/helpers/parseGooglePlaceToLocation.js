/**
 * Convert a Google Places result into the backend structured `location` shape.
 *
 * The org edit form's `GMapAutocomplete` builds the object handed in here (see
 * `EditOrgsForm.vue`'s `setAddress`): it carries `addressComponents`, the raw
 * Google `address_components[]` array, where each entry is
 * `{ long_name, short_name, types[] }`. The backend org `location` object
 * (used by the district / school / group PATCH endpoints) is flat and
 * structured: `{ addressLine1, addressLine2, city, stateProvince, postalCode,
 * country }`.
 *
 * Field mapping:
 * - `addressLine1` — `street_number` + ' ' + `route` (long names)
 * - `addressLine2` — `subpremise` (long name), when present
 * - `city`         — `locality`, falling back to `postal_town` then
 *                    `sublocality` (long names)
 * - `stateProvince`— `administrative_area_level_1` (short name)
 * - `postalCode`   — `postal_code` (long name)
 * - `country`      — `country` (short name)
 *
 * The result is a PARTIAL object: a field is only included when its underlying
 * component(s) are present, so missing parts are omitted rather than emitted as
 * empty strings. A missing or empty `addressComponents` yields `{}`.
 *
 * @param {Object|null|undefined} place - The Google Places object built by
 *   `setAddress` (`{ addressComponents, formattedAddress, googlePlacesId,
 *   googleMapsUrl }`). Only `addressComponents` is read.
 * @returns {{
 *   addressLine1?: string,
 *   addressLine2?: string,
 *   city?: string,
 *   stateProvince?: string,
 *   postalCode?: string,
 *   country?: string,
 * }} The structured backend `location` (a partial object).
 */
export const parseGooglePlaceToLocation = (place) => {
  const components = place?.addressComponents;
  if (!Array.isArray(components) || components.length === 0) return {};

  // Find the first component whose `types` include the requested Google type,
  // returning the chosen name field (defaults to `long_name`).
  const find = (type, field = 'long_name') => {
    const component = components.find((c) => Array.isArray(c?.types) && c.types.includes(type));
    return component?.[field] ?? undefined;
  };

  const location = {};

  // addressLine1: street number + route, omitting whichever part is absent.
  const streetNumber = find('street_number');
  const route = find('route');
  const addressLine1 = [streetNumber, route].filter(Boolean).join(' ');
  if (addressLine1) location.addressLine1 = addressLine1;

  // addressLine2: unit / suite (subpremise), when present.
  const subpremise = find('subpremise');
  if (subpremise) location.addressLine2 = subpremise;

  // city: locality, then postal_town, then sublocality.
  const city = find('locality') ?? find('postal_town') ?? find('sublocality');
  if (city) location.city = city;

  // stateProvince: the 2-letter (short) region code.
  const stateProvince = find('administrative_area_level_1', 'short_name');
  if (stateProvince) location.stateProvince = stateProvince;

  // postalCode.
  const postalCode = find('postal_code');
  if (postalCode) location.postalCode = postalCode;

  // country: the 2-letter (short) country code.
  const country = find('country', 'short_name');
  if (country) location.country = country;

  return location;
};

export default parseGooglePlaceToLocation;
