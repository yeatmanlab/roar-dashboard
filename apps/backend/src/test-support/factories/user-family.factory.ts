import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { UserFamily, NewUserFamily } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { userFamilies } from '../../db/schema/core';

/**
 * Factory for creating UserFamily test objects.
 *
 * Usage:
 * - `UserFamilyFactory.build()` - Creates in-memory object (unit tests)
 * - `await UserFamilyFactory.create()` - Persists to database (integration tests)
 *
 * Note: Children can only be in ONE active family at a time (unique constraint WHERE role='child' AND leftOn IS NULL).
 * Parents can be in multiple families. Use leftOn = null for active memberships.
 *
 * Schema limitation: role enum only has ['parent', 'child'], missing ['guardian', 'relative'].
 * See issue #1707.
 */
export const UserFamilyFactory = Factory.define<UserFamily>(({ onCreate }) => {
  onCreate(async (userFamily) => {
    const insertData: NewUserFamily = {
      userId: userFamily.userId,
      familyId: userFamily.familyId,
      role: userFamily.role,
      joinedOn: userFamily.joinedOn,
      leftOn: userFamily.leftOn,
    };

    const [inserted] = await CoreDbClient.insert(userFamilies).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert user family');
    return inserted;
  });

  return {
    userId: faker.string.uuid(),
    familyId: faker.string.uuid(),
    role: faker.helpers.arrayElement(['parent', 'child'] as const),
    joinedOn: new Date(),
    leftOn: null, // null = active membership
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
