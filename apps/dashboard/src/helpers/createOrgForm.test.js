import { describe, it, expect } from 'vitest';
import { GRADE_OPTIONS, CLASS_TYPE_OPTIONS, GROUP_TYPE_OPTIONS, buildOrgCreateBody } from './createOrgForm';

// A representative Google Places `address_components[]` array, shaped exactly as
// the form's GMapAutocomplete stores it under `state.address.addressComponents`.
const ADDRESS_COMPONENTS = [
  { long_name: '450', short_name: '450', types: ['street_number'] },
  { long_name: 'Serra Mall', short_name: 'Serra Mall', types: ['route'] },
  { long_name: 'Stanford', short_name: 'Stanford', types: ['locality'] },
  { long_name: 'California', short_name: 'CA', types: ['administrative_area_level_1'] },
  { long_name: '94305', short_name: '94305', types: ['postal_code'] },
  { long_name: 'United States', short_name: 'US', types: ['country'] },
];

const addressState = {
  addressComponents: ADDRESS_COMPONENTS,
  formattedAddress: '450 Serra Mall, Stanford, CA 94305, USA',
};

const STRUCTURED_LOCATION = {
  addressLine1: '450 Serra Mall',
  city: 'Stanford',
  stateProvince: 'CA',
  postalCode: '94305',
  country: 'US',
};

describe('createOrgForm helpers', () => {
  describe('option lists', () => {
    it('maps grade values to UserGradeSchema values (strings, K/PreK spelled out)', () => {
      const byLabel = Object.fromEntries(GRADE_OPTIONS.map((o) => [o.label, o.value]));

      expect(byLabel['Pre-K']).toBe('PreKindergarten');
      expect(byLabel['Transitional Kindergarten']).toBe('TransitionalKindergarten');
      expect(byLabel['Kindergarten']).toBe('Kindergarten');
      expect(byLabel['Grade 1']).toBe('1');
      expect(byLabel['Grade 12']).toBe('12');
      // Numbered grades are strings, not numbers.
      GRADE_OPTIONS.filter((o) => /^Grade \d+$/.test(o.label)).forEach((o) => {
        expect(typeof o.value).toBe('string');
      });
    });

    it('exposes class and group type options matching the backend enums', () => {
      expect(CLASS_TYPE_OPTIONS.map((o) => o.value)).toEqual(['homeroom', 'scheduled', 'other']);
      expect(GROUP_TYPE_OPTIONS.map((o) => o.value)).toEqual(['cohort', 'community', 'business']);
    });
  });

  describe('buildOrgCreateBody — districts', () => {
    it('builds the exact district body with structured location and nested identifiers', () => {
      const state = {
        orgName: 'Acme District',
        orgInitials: 'AD',
        ncesId: '1234567',
        address: addressState,
      };

      expect(buildOrgCreateBody('districts', state)).toEqual({
        name: 'Acme District',
        abbreviation: 'AD',
        location: STRUCTURED_LOCATION,
        identifiers: { ncesId: '1234567' },
      });
    });

    it('omits location and identifiers when not supplied', () => {
      const state = { orgName: 'Bare District', orgInitials: 'BD' };
      const body = buildOrgCreateBody('districts', state);

      expect(body).toEqual({ name: 'Bare District', abbreviation: 'BD' });
      expect(body).not.toHaveProperty('location');
      expect(body).not.toHaveProperty('identifiers');
    });
  });

  describe('buildOrgCreateBody — schools', () => {
    it('builds the exact school body with districtId, location, and identifiers', () => {
      const state = {
        orgName: 'Acme School',
        orgInitials: 'AS',
        ncesId: '123456789012',
        address: addressState,
        parentDistrict: { id: 'district-1' },
      };

      expect(buildOrgCreateBody('schools', state)).toEqual({
        districtId: 'district-1',
        name: 'Acme School',
        abbreviation: 'AS',
        location: STRUCTURED_LOCATION,
        identifiers: { ncesId: '123456789012' },
      });
    });
  });

  describe('buildOrgCreateBody — classes', () => {
    const state = {
      orgName: 'Room 101',
      orgInitials: 'IGNORED',
      ncesId: 'IGNORED',
      address: addressState,
      parentSchool: { id: 'school-1' },
      parentDistrict: { id: 'district-1' },
      classType: 'homeroom',
      grade: { label: 'Grade 3', value: '3' },
    };

    it('builds schoolId, name, classType, and grades (schema values, as an array)', () => {
      expect(buildOrgCreateBody('classes', state)).toEqual({
        schoolId: 'school-1',
        name: 'Room 101',
        classType: 'homeroom',
        grades: ['3'],
      });
    });

    it('never includes abbreviation, districtId, or location for classes', () => {
      const body = buildOrgCreateBody('classes', state);
      expect(body).not.toHaveProperty('abbreviation');
      expect(body).not.toHaveProperty('districtId');
      expect(body).not.toHaveProperty('location');
    });

    it('omits grades when no grade is selected', () => {
      const body = buildOrgCreateBody('classes', { ...state, grade: undefined });
      expect(body).not.toHaveProperty('grades');
    });
  });

  describe('buildOrgCreateBody — groups', () => {
    it('builds name, abbreviation, groupType, and location', () => {
      const state = {
        orgName: 'Acme Cohort',
        orgInitials: 'AC',
        groupType: 'cohort',
        address: addressState,
      };

      expect(buildOrgCreateBody('groups', state)).toEqual({
        name: 'Acme Cohort',
        abbreviation: 'AC',
        groupType: 'cohort',
        location: STRUCTURED_LOCATION,
      });
    });
  });

  describe('location omission', () => {
    it('omits location when the address parses to an empty object', () => {
      // addressComponents present but with no recognized component types →
      // parseGooglePlaceToLocation returns {}, so location must be omitted.
      const state = {
        orgName: 'No Address District',
        orgInitials: 'NA',
        address: { addressComponents: [{ long_name: 'x', short_name: 'x', types: ['premise'] }] },
      };
      const body = buildOrgCreateBody('districts', state);
      expect(body).not.toHaveProperty('location');
    });

    it('omits location when no address is selected', () => {
      const body = buildOrgCreateBody('groups', { orgName: 'G', orgInitials: 'G', groupType: 'cohort' });
      expect(body).not.toHaveProperty('location');
    });
  });

  describe('retired fields never leak', () => {
    it('emits no tags / testData / demoData keys for any org type', () => {
      const state = {
        orgName: 'X',
        orgInitials: 'X',
        ncesId: '1234567',
        address: addressState,
        parentDistrict: { id: 'd' },
        parentSchool: { id: 's' },
        classType: 'homeroom',
        groupType: 'cohort',
        grade: { label: 'Grade 1', value: '1' },
        // Stray retired fields that must be ignored:
        tags: ['a', 'b'],
        testData: true,
        demoData: true,
      };

      for (const orgType of ['districts', 'schools', 'classes', 'groups']) {
        const body = buildOrgCreateBody(orgType, state);
        expect(body).not.toHaveProperty('tags');
        expect(body).not.toHaveProperty('testData');
        expect(body).not.toHaveProperty('demoData');
      }
    });
  });

  it('throws on an unsupported org type', () => {
    expect(() => buildOrgCreateBody('families', { orgName: 'F' })).toThrow(/Unsupported org type for create/);
  });
});
