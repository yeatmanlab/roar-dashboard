import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { User } from '../../db/schema';
import type { AuthContext } from '../../services/auth/auth.types';

/**
 * Factory for creating User test objects.
 */
export const UserFactory = Factory.define<User>(() => ({
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
}));

/**
 * Factory for creating AuthContext test objects.
 */
export const AuthContextFactory = Factory.define<AuthContext>(() => ({
  id: faker.string.uuid(),
  isSuperAdmin: faker.datatype.boolean(),
}));
