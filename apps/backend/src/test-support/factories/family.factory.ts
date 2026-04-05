import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Family, NewFamily } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { families } from '../../db/schema/core';

/**
 * Factory for creating Family test objects.
 *
 * Usage:
 * - `FamilyFactory.build()` - Creates in-memory object (unit tests)
 * - `await FamilyFactory.create()` - Persists to database (integration tests)
 *
 * Note: Families have no name field - they are identified by UUID only.
 * Location fields are optional and used for geographic analysis.
 */
export const FamilyFactory = Factory.define<Family>(({ onCreate }) => {
  onCreate(async (family) => {
    const insertData: NewFamily = {
      id: family.id,
      locationAddressLine1: family.locationAddressLine1,
      locationAddressLine2: family.locationAddressLine2,
      locationCity: family.locationCity,
      locationStateProvince: family.locationStateProvince,
      locationPostalCode: family.locationPostalCode,
      locationCountry: family.locationCountry,
      locationLatLong: family.locationLatLong,
      rosteringEnded: family.rosteringEnded,
    };

    const [inserted] = await CoreDbClient.insert(families).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert family');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationStateProvince: null,
    locationPostalCode: null,
    locationCountry: null,
    locationLatLong: null,
    rosteringEnded: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
