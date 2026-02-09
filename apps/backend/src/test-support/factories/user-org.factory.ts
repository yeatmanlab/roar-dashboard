import { Factory } from 'fishery';
import type { UserOrg, NewUserOrg } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { userOrgs } from '../../db/schema/core';
import { UserRole } from '../../enums/user-role.enum';

/**
 * Factory for creating UserOrg junction table records.
 *
 * Usage:
 * - `UserOrgFactory.build()` - Creates in-memory object (unit tests)
 * - `await UserOrgFactory.create({ userId, orgId, role })` - Persists to database
 *
 * IMPORTANT: userId, orgId, and role are required for database persistence.
 */
export const UserOrgFactory = Factory.define<UserOrg>(({ onCreate }) => {
  onCreate(async (userOrg) => {
    if (!userOrg.userId || !userOrg.orgId) {
      throw new Error('UserOrgFactory.create() requires userId and orgId');
    }

    const insertData: NewUserOrg = {
      userId: userOrg.userId,
      orgId: userOrg.orgId,
      role: userOrg.role,
      enrollmentStart: userOrg.enrollmentStart,
      enrollmentEnd: userOrg.enrollmentEnd,
    };

    const [inserted] = await CoreDbClient.insert(userOrgs).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert user_org');
    return inserted;
  });

  return {
    userId: '00000000-0000-0000-0000-000000000000', // Override required
    orgId: '00000000-0000-0000-0000-000000000000', // Override required
    role: UserRole.STUDENT,
    enrollmentStart: new Date(),
    enrollmentEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
