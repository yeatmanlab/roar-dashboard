import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { User, NewUser } from '../../db/schema';
import type { AuthContext } from '../../services/auth/auth.types';
import { CoreDbClient } from '../../db/clients';
import { users } from '../../db/schema/core';

/**
 * Factory for creating User test objects.
 *
 * Usage:
 * - `UserFactory.build()` - Creates in-memory object (unit tests)
 * - `await UserFactory.create()` - Persists to database (integration tests)
 */
export const UserFactory = Factory.define<User>(({ onCreate }) => {
  onCreate(async (user) => {
    // Extract only insertable fields (exclude generated columns like schoolLevel)
    const insertData: NewUser = {
      id: user.id,
      assessmentPid: user.assessmentPid,
      authProvider: user.authProvider,
      authId: user.authId,
      nameFirst: user.nameFirst,
      nameMiddle: user.nameMiddle,
      nameLast: user.nameLast,
      username: user.username,
      email: user.email,
      userType: user.userType,
      dob: user.dob,
      grade: user.grade,
      // schoolLevel is generated, don't include
      statusEll: user.statusEll,
      statusFrl: user.statusFrl,
      statusIep: user.statusIep,
      studentId: user.studentId,
      sisId: user.sisId,
      stateId: user.stateId,
      localId: user.localId,
      gender: user.gender,
      race: user.race,
      hispanicEthnicity: user.hispanicEthnicity,
      homeLanguage: user.homeLanguage,
      excludeFromResearch: user.excludeFromResearch,
      isSuperAdmin: user.isSuperAdmin,
    };

    const [inserted] = await CoreDbClient.insert(users).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert user');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    assessmentPid: faker.string.alphanumeric(12),
    authProvider: ['password'],
    authId: faker.string.uuid(),
    nameFirst: faker.person.firstName(),
    nameMiddle: null,
    nameLast: faker.person.lastName(),
    username: faker.internet.username(),
    email: faker.internet.email(),
    userType: faker.helpers.arrayElement(['student', 'educator', 'caregiver', 'admin'] as const),
    dob: null,
    grade: null,
    schoolLevel: null,
    statusEll: null,
    statusFrl: null,
    statusIep: null,
    studentId: null,
    sisId: null,
    stateId: null,
    localId: null,
    gender: null,
    race: null,
    hispanicEthnicity: null,
    homeLanguage: null,
    excludeFromResearch: false,
    isSuperAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

/**
 * Factory for creating AuthContext test objects.
 */
export const AuthContextFactory = Factory.define<AuthContext>(() => ({
  id: faker.string.uuid(),
  isSuperAdmin: faker.datatype.boolean(),
}));
