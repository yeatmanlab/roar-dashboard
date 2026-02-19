import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Group, NewGroup } from '../../db/schema';
import { getCoreDbClient } from '../../db/clients';
import { groups } from '../../db/schema/core';
import { GroupType } from '../../enums/group-type.enum';

/**
 * Factory for creating Group test objects.
 *
 * Usage:
 * - `GroupFactory.build()` - Creates in-memory object (unit tests)
 * - `await GroupFactory.create()` - Persists to database (integration tests)
 *
 * NOTE: Groups are flat entities with no hierarchy (unlike orgs).
 */
export const GroupFactory = Factory.define<Group>(({ onCreate }) => {
  onCreate(async (group) => {
    const insertData: NewGroup = {
      id: group.id,
      name: group.name,
      abbreviation: group.abbreviation,
      groupType: group.groupType,
      locationAddressLine1: group.locationAddressLine1,
      locationAddressLine2: group.locationAddressLine2,
      locationCity: group.locationCity,
      locationStateProvince: group.locationStateProvince,
      locationPostalCode: group.locationPostalCode,
      locationCountry: group.locationCountry,
    };

    const [inserted] = await getCoreDbClient().insert(groups).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert group');
    return inserted;
  });

  const groupName = `${faker.word.words(3).replace(/\b\w/g, (c) => c.toUpperCase())} ${GroupType.COHORT}`;
  const groupAbbreviation = groupName
    .split(' ')
    .map((word) => word.charAt(0))
    .join('');

  return {
    id: faker.string.uuid(),
    name: groupName,
    abbreviation: groupAbbreviation,
    groupType: GroupType.COHORT,
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
