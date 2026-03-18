import { describe, it, expect } from 'vitest';
import { getEnrolledUsersFilterConditions, ENROLLED_USERS_SORT_COLUMNS } from './enrolled-users-query.utils';
import { users } from '../../db/schema';
import { UserRole } from '../../enums/user-role.enum';
import { ListEnrolledUsersOptions } from '../../types/user';

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
    it('returns empty array when no filters provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10 };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toEqual([]);
    });

    it('returns grade condition when grade filter provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, grade: ['5'] };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toHaveLength(1);
    });

    it('returns role condition when role filter provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, role: UserRole.STUDENT };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toHaveLength(1);
    });

    it('returns both conditions when grade and role filters provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, grade: ['5'], role: UserRole.STUDENT };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toHaveLength(2);
    });
  });
});
