import { eq, and, isNull, count, asc, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { Family, NewFamily, NewUser } from '../db/schema';
import { families, userFamilies, users } from '../db/schema';
import { UserFamilyRole } from '../enums/user-family-role.enum';
import { CoreDbClient } from '../db/clients';
import type { CoreTransaction } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { EnrolledFamilyUserEntity, ListEnrolledFamilyUsersOptions } from '../types/user';
import {
  getEnrolledUsersFilterConditions,
  ENROLLED_USERS_SORT_COLUMNS,
  UserJunctionTable,
} from './utils/enrolled-users-query.utils';
import { isEnrollmentActive } from './utils/enrollment.utils';

/**
 * Name of the partial unique index that enforces "one family per caretaker"
 * on `app.families`. Exported so that the service layer can map this specific
 * constraint to a 422 response (any other unique violation should map to 409
 * or 500 depending on the source).
 */
export const FAMILIES_CREATED_BY_UNIQ_IDX = 'families_created_by_uniq_idx';
/**
 * Family Repository
 *
 * Handles data access for families.
 * Provides both unrestricted access (for super admins) and FGA-filtered access
 * (for regular users based on their FGA object membership).
 */
export class FamilyRepository extends BaseRepository<Family, typeof families> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, families);
  }

  /**
   * Create a new caretaker user, a new family with `createdBy` set to that caretaker, and the
   * `user_families` row that links them with role='parent', all within a single transaction.
   *
   * The rostering_provider_ids row is intentionally NOT written here — the caller writes it via
   * `RosterProviderIdRepository.create({ ..., transaction })` in the same transaction. Splitting
   * the writes keeps the partner-id resolution decision (which the service owns) outside this
   * repository.
   *
   * On a `unique_violation` against `families_created_by_uniq_idx`, the partial unique index for
   * the "one family per caretaker" rule has fired — the service translates this to a 422 by
   * calling `isUniqueViolationOnConstraint(error, FAMILIES_CREATED_BY_UNIQ_IDX)`.
   *
   * @param caretakerData - The caretaker fields to insert into `users` (excluding the id)
   * @param familyData - The family fields to insert (excluding the id and createdBy)
   * @param transaction - The active transaction to execute writes within
   * @returns The newly created caretaker and family ids
   */
  async createWithCaretaker(
    caretakerData: Omit<NewUser, 'id'>,
    familyData: Omit<NewFamily, 'id' | 'createdBy'>,
    transaction: CoreTransaction,
  ): Promise<{ caretakerId: string; familyId: string }> {
    const [createdUser] = await transaction.insert(users).values(caretakerData).returning({ id: users.id });
    if (!createdUser) {
      throw new Error('User insert returned no rows');
    }
    const caretakerId = createdUser.id;

    const [createdFamily] = await transaction
      .insert(families)
      .values({ ...familyData, createdBy: caretakerId })
      .returning({ id: families.id });
    if (!createdFamily) {
      throw new Error('Family insert returned no rows');
    }
    const familyId = createdFamily.id;

    await transaction.insert(userFamilies).values({
      userId: caretakerId,
      familyId,
      role: UserFamilyRole.PARENT,
      joinedOn: new Date(),
    });

    return { caretakerId, familyId };
  }

  /**
   * Get family IDs for a specific user (active memberships only).
   *
   * @param userId - The user whose families to retrieve
   * @returns Array of family IDs the user actively belongs to
   */
  async getFamilyIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ familyId: userFamilies.familyId })
      .from(userFamilies)
      .where(and(eq(userFamilies.userId, userId), isNull(userFamilies.leftOn)));
    return rows.map((r) => r.familyId);
  }

  /**
   * Get users enrolled in a family with pagination and filtering
   * @param familyId - The family ID to filter users by
   * @param options - Pagination and filtering options
   * @returns Paginated result with enrolled users and total count
   */
  async getUsersByFamilyId(
    familyId: string,
    options: ListEnrolledFamilyUsersOptions,
  ): Promise<PaginatedResult<EnrolledFamilyUserEntity>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const familyConditions = and(
      isEnrollmentActive({ enrollmentStart: userFamilies.joinedOn, enrollmentEnd: userFamilies.leftOn }),
      isNull(families.rosteringEnded),
      eq(userFamilies.familyId, familyId),
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_FAMILIES),
    );

    const countResult = await this.db
      .select({ count: count() })
      .from(userFamilies)
      .innerJoin(users, eq(users.id, userFamilies.userId))
      .innerJoin(families, eq(families.id, userFamilies.familyId))
      .where(familyConditions);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, role: userFamilies.role })
      .from(userFamilies)
      .innerJoin(users, eq(users.id, userFamilies.userId))
      .innerJoin(families, eq(families.id, userFamilies.familyId))
      .where(familyConditions)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, roles: [row.role] })),
      totalItems,
    };
  }
}
