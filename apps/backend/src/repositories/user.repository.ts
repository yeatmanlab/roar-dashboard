import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, type User } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
// TODO: Should this be redeclared? Looking at 1562
//import type { BasePaginatedQueryParams, PaginatedResult } from './interfaces/base.repository.interface';
import { BaseRepository } from './base.repository';
// TODO: Where should these enums be imported from? Contract?
//import { type UserRole } from '../enums/user-role.enum';
//import { type UserType } from '../enums/user-type.enum'
//import { type Grade } from '../enums/grade.enum'
// TODO: Add type to variable name
//import { type UserSortField } from '@roar-dashboard/api-contract';

// TODO: Move sort columns type to here
/*interface ListByEntityIdOptions extends BasePaginatedQueryParams {
  role?: UserRole;
  userType?: UserType;
  grade?: Grade;
  active?: boolean;
}*/
/*
What are the sort fields? This was based on the ticket
const SORT_FIELD_TO_COLUMN: Record<UserSortField, Column> = {
  'name.last': users.nameLast,
  'username': users.username,
  'grade': users.grade,
  'enrollmentStart': userClasses.enrollmentStart,
}*/

/**
 * User Repository
 *
 * Provides data access methods for the users table using Drizzle ORM.
 * Extends BaseRepository for standard CRUD operations.
 * Uses CoreDbClient by default, but accepts a custom DB client for testing.
 */
export class UserRepository extends BaseRepository<User, typeof users> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, users);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom methods (not part of BaseRepository)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Find a user by their Firebase authentication ID.
   *
   * @param authId - The Firebase UID to look up.
   * @returns The user record if found, null otherwise.
   */
  async findByAuthId(authId: string): Promise<User | null> {
    const [user] = await this.db.select().from(this.table).where(eq(users.authId, authId)).limit(1);

    return user ?? null;
  }

  /**
   * List users by class ID
   
  async listByClassId(classId: string, options: ListByEntityIdOptions): Promise<PaginatedResult<User>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;
    console.log(options);

    const whereCondition = eq(userClasses.classId, classId);

    const dataResult = await this.db.select({ user: users }).from(users).innerJoin(userClasses, eq(this.table.id, userClasses.userId)).where(whereCondition);

    return {
      items: dataResult.map((row) => row.user),
      totalItems: dataResult.length,
    };
  }*/
}
