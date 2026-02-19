import { Factory } from 'fishery';
import type { UserClass, NewUserClass } from '../../db/schema';
import { getCoreDbClient } from '../../db/clients';
import { userClasses } from '../../db/schema/core';
import { UserRole } from '../../enums/user-role.enum';

/**
 * Factory for creating UserClass junction table records.
 *
 * Usage:
 * - `UserClassFactory.build()` - Creates in-memory object (unit tests)
 * - `await UserClassFactory.create({ userId, classId, role })` - Persists to database
 *
 * IMPORTANT: userId, classId, and role are required for database persistence.
 */
export const UserClassFactory = Factory.define<UserClass>(({ onCreate }) => {
  onCreate(async (userClass) => {
    if (!userClass.userId || !userClass.classId) {
      throw new Error('UserClassFactory.create() requires userId and classId');
    }

    const insertData: NewUserClass = {
      userId: userClass.userId,
      classId: userClass.classId,
      role: userClass.role,
      enrollmentStart: userClass.enrollmentStart,
      enrollmentEnd: userClass.enrollmentEnd,
    };

    const [inserted] = await getCoreDbClient().insert(userClasses).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert user_class');
    return inserted;
  });

  return {
    userId: '00000000-0000-0000-0000-000000000000', // Override required
    classId: '00000000-0000-0000-0000-000000000000', // Override required
    role: UserRole.STUDENT,
    enrollmentStart: new Date(),
    enrollmentEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
