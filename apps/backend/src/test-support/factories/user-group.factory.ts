import { Factory } from 'fishery';
import type { UserGroup, NewUserGroup } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { userGroups } from '../../db/schema/core';
import { UserRole } from '../../enums/user-role.enum';

/**
 * Factory for creating UserGroup junction table records.
 *
 * Usage:
 * - `UserGroupFactory.build()` - Creates in-memory object (unit tests)
 * - `await UserGroupFactory.create({ userId, groupId, role })` - Persists to database
 *
 * IMPORTANT: userId, groupId, and role are required for database persistence.
 */
export const UserGroupFactory = Factory.define<UserGroup>(({ onCreate }) => {
  onCreate(async (userGroup) => {
    if (!userGroup.userId || !userGroup.groupId) {
      throw new Error('UserGroupFactory.create() requires userId and groupId');
    }

    const insertData: NewUserGroup = {
      userId: userGroup.userId,
      groupId: userGroup.groupId,
      role: userGroup.role,
      enrollmentStart: userGroup.enrollmentStart,
      enrollmentEnd: userGroup.enrollmentEnd,
    };

    const [inserted] = await CoreDbClient.insert(userGroups).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert user_group');
    return inserted;
  });

  return {
    userId: '00000000-0000-0000-0000-000000000000', // Override required
    groupId: '00000000-0000-0000-0000-000000000000', // Override required
    role: UserRole.STUDENT,
    enrollmentStart: new Date(),
    enrollmentEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
