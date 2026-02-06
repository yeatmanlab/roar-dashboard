import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { orgs, type Org } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { PaginationQuery, SortQuery, type UserSortField, UsersQueryFilters } from '@roar-dashboard/api-contract';
import { BaseRepository } from './base.repository';

export type OrgUsersQueryOptions = PaginationQuery & SortQuery<UserSortField> & UsersQueryFilters;

export class OrgRepository extends BaseRepository<Org, typeof orgs> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, orgs);
  }

  /**
   * Find a org with the given id and orgType.
   * @params
   */
}
