import { describe, it, expect } from 'vitest';
import {
  buildEnrolledUserSelection,
  getEnrolledUsersFilterConditions,
  mapEnrolledUserRow,
  ENROLLED_USERS_SORT_COLUMNS,
  UserJunctionTable,
} from './enrolled-users-query.utils';
import { users } from '../../db/schema';
import { UserRole } from '../../enums/user-role.enum';
import type { EnrolledUserBase, EnrolledUserDemographicsEntity, ListEnrolledUsersOptions } from '../../types/user';

describe('enrolled-users-query.utils', () => {
  describe('ENROLLED_USERS_SORT_COLUMNS', () => {
    it('maps nameLast to users.nameLast column', () => {
      expect(ENROLLED_USERS_SORT_COLUMNS.nameLast).toBe(users.nameLast);
    });

    it('maps username to users.username column', () => {
      expect(ENROLLED_USERS_SORT_COLUMNS.username).toBe(users.username);
    });

    it('maps grade to users.grade column', () => {
      expect(ENROLLED_USERS_SORT_COLUMNS.grade).toBe(users.grade);
    });
  });

  describe('getEnrolledUsersFilterConditions', () => {
    // The base array always includes the `isActiveRoster(users)` predicate
    // (#1742). Every user-list endpoint must exclude rostering-ended users
    // unconditionally, so it's wired at the query composition layer rather
    // than added by each caller. Length assertions below account for it.
    const BASE_CONDITION_COUNT = 1;

    it('returns only the active-roster condition when no filters provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10 };
      const conditions = getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_CLASSES);
      expect(conditions).toHaveLength(BASE_CONDITION_COUNT);
    });

    it('appends grade condition when grade filter provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, grade: ['5'] };
      const conditions = getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_CLASSES);
      expect(conditions).toHaveLength(BASE_CONDITION_COUNT + 1);
    });

    it('appends role condition when role filter provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, role: UserRole.STUDENT };
      const conditions = getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_CLASSES);
      expect(conditions).toHaveLength(BASE_CONDITION_COUNT + 1);
    });

    it('appends both conditions when grade and role filters provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, grade: ['5'], role: UserRole.STUDENT };
      const conditions = getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_CLASSES);
      expect(conditions).toHaveLength(BASE_CONDITION_COUNT + 2);
    });
  });

  describe('buildEnrolledUserSelection', () => {
    // The lean base column set every enrolled-user query selects.
    const BASE_COLUMN_KEYS = [
      'id',
      'assessmentPid',
      'nameFirst',
      'nameLast',
      'username',
      'email',
      'gender',
      'grade',
      'dob',
      'studentId',
      'sisId',
      'stateId',
      'localId',
    ];

    it('selects only the base user columns when demographics are not embedded', () => {
      const selection = buildEnrolledUserSelection(false);

      expect(Object.keys(selection)).toEqual(['user']);
      expect(Object.keys(selection.user)).toEqual(BASE_COLUMN_KEYS);
      // The PII columns must NOT be fetched by the default query.
      expect(selection).not.toHaveProperty('demographics');
    });

    it('additionally selects the demographic columns when demographics are embedded', () => {
      const selection = buildEnrolledUserSelection(true);

      expect(Object.keys(selection)).toEqual(['user', 'demographics']);
      expect(Object.keys(selection.user)).toEqual(BASE_COLUMN_KEYS);
      expect(Object.keys(selection.demographics!)).toEqual([
        'userType',
        'statusEll',
        'statusFrl',
        'statusIep',
        'race',
        'hispanicEthnicity',
        'homeLanguage',
      ]);
      // Base columns map to the real Drizzle columns.
      expect(selection.user.id).toBe(users.id);
      // Demographic columns map to the real Drizzle columns.
      expect(selection.demographics!.userType).toBe(users.userType);
      expect(selection.demographics!.statusEll).toBe(users.statusEll);
    });
  });

  describe('mapEnrolledUserRow', () => {
    const baseRow: { user: EnrolledUserBase } = {
      user: {
        id: 'user-1',
        assessmentPid: 'pid-1',
        nameFirst: 'Ada',
        nameLast: 'Lovelace',
        username: 'ada',
        email: 'ada@example.com',
        gender: 'female',
        grade: '5',
        dob: '2014-01-01',
        studentId: 'stu-1',
        sisId: 'sis-1',
        stateId: 'state-1',
        localId: 'local-1',
      },
    };

    it('spreads the base user columns and attaches roles', () => {
      const mapped = mapEnrolledUserRow(baseRow, [UserRole.STUDENT]);

      expect(mapped.id).toBe('user-1');
      expect(mapped.nameLast).toBe('Lovelace');
      expect(mapped.roles).toEqual([UserRole.STUDENT]);
    });

    it('omits demographics when the row carries none (base query)', () => {
      const mapped = mapEnrolledUserRow(baseRow, [UserRole.STUDENT]);

      expect(mapped).not.toHaveProperty('demographics');
    });

    it('attaches demographics when the row carries them (embed query)', () => {
      const demographics: EnrolledUserDemographicsEntity = {
        userType: 'student',
        statusEll: 'Yes',
        statusFrl: 'Free',
        statusIep: null,
        race: 'White',
        hispanicEthnicity: false,
        homeLanguage: 'English',
      };
      const mapped = mapEnrolledUserRow({ ...baseRow, demographics }, [UserRole.STUDENT]);

      expect(mapped.demographics).toEqual(demographics);
    });
  });
});
