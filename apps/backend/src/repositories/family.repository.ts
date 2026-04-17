// import { eq, countDistinct, and, isNull, sql, inArray } from 'drizzle-orm';
// import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
//import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { Family } from '../db/schema';
import { families } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';

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
}
