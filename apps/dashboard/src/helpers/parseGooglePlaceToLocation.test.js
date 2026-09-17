import { describe, it, expect } from 'vitest';
import { parseGooglePlaceToLocation } from './parseGooglePlaceToLocation';

// A representative Google `address_components[]` array, shaped exactly as the
// Places API returns it (and as `setAddress` stores it under
// `addressComponents`).
const fullPlace = {
  formattedAddress: '1600 Amphitheatre Pkwy #200, Mountain View, CA 94043, USA',
  googlePlacesId: 'place-123',
  googleMapsUrl: 'https://maps.google.com/?cid=123',
  addressComponents: [
    { long_name: '200', short_name: '200', types: ['subpremise'] },
    { long_name: '1600', short_name: '1600', types: ['street_number'] },
    { long_name: 'Amphitheatre Parkway', short_name: 'Amphitheatre Pkwy', types: ['route'] },
    { long_name: 'Mountain View', short_name: 'Mountain View', types: ['locality', 'political'] },
    {
      long_name: 'Santa Clara County',
      short_name: 'Santa Clara County',
      types: ['administrative_area_level_2', 'political'],
    },
    { long_name: 'California', short_name: 'CA', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
    { long_name: '94043', short_name: '94043', types: ['postal_code'] },
  ],
};

describe('parseGooglePlaceToLocation', () => {
  it('maps a full address_components array to the structured location shape', () => {
    expect(parseGooglePlaceToLocation(fullPlace)).toEqual({
      addressLine1: '1600 Amphitheatre Parkway',
      addressLine2: '200',
      city: 'Mountain View',
      stateProvince: 'CA',
      postalCode: '94043',
      country: 'US',
    });
  });

  it('uses short_name for state/country and long_name for street and city', () => {
    const result = parseGooglePlaceToLocation(fullPlace);
    // long_name for the route ("Parkway", not "Pkwy")
    expect(result.addressLine1).toBe('1600 Amphitheatre Parkway');
    // short_name for region and country codes
    expect(result.stateProvince).toBe('CA');
    expect(result.country).toBe('US');
  });

  it('omits fields whose components are absent rather than emitting empty strings', () => {
    const place = {
      addressComponents: [
        { long_name: 'Springfield', short_name: 'Springfield', types: ['locality', 'political'] },
        { long_name: 'Illinois', short_name: 'IL', types: ['administrative_area_level_1', 'political'] },
      ],
    };
    expect(parseGooglePlaceToLocation(place)).toEqual({
      city: 'Springfield',
      stateProvince: 'IL',
    });
  });

  it('builds addressLine1 from only the parts that are present', () => {
    const routeOnly = {
      addressComponents: [{ long_name: 'Main Street', short_name: 'Main St', types: ['route'] }],
    };
    expect(parseGooglePlaceToLocation(routeOnly)).toEqual({ addressLine1: 'Main Street' });

    const numberOnly = {
      addressComponents: [{ long_name: '42', short_name: '42', types: ['street_number'] }],
    };
    expect(parseGooglePlaceToLocation(numberOnly)).toEqual({ addressLine1: '42' });
  });

  it('includes addressLine2 from a subpremise even when addressLine1 is absent', () => {
    const subpremiseOnly = {
      addressComponents: [{ long_name: 'Suite 200', short_name: 'Ste 200', types: ['subpremise'] }],
    };
    expect(parseGooglePlaceToLocation(subpremiseOnly)).toEqual({ addressLine2: 'Suite 200' });
  });

  it('falls back to postal_town then sublocality for the city', () => {
    const postalTown = {
      addressComponents: [{ long_name: 'London', short_name: 'London', types: ['postal_town'] }],
    };
    expect(parseGooglePlaceToLocation(postalTown)).toEqual({ city: 'London' });

    const sublocality = {
      addressComponents: [{ long_name: 'Brooklyn', short_name: 'Brooklyn', types: ['sublocality', 'political'] }],
    };
    expect(parseGooglePlaceToLocation(sublocality)).toEqual({ city: 'Brooklyn' });
  });

  it('returns an empty object when addressComponents is missing or empty', () => {
    expect(parseGooglePlaceToLocation(undefined)).toEqual({});
    expect(parseGooglePlaceToLocation(null)).toEqual({});
    expect(parseGooglePlaceToLocation({})).toEqual({});
    expect(parseGooglePlaceToLocation({ addressComponents: [] })).toEqual({});
    expect(parseGooglePlaceToLocation({ addressComponents: undefined })).toEqual({});
  });
});
