import type * as CoreDbSchema from '../../db/schema/core';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { parseAccessControlFilter, type AccessControlFilter } from '../utils/parse-access-control-filter.utils';
// import { logger } from '../../logger';

/**
 * Tasks Access Controls
 */

export class TaskAccessControls {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  async isSuperAdmin(accessControlFilter: AccessControlFilter) {
    const { userId } = parseAccessControlFilter(accessControlFilter);
    const userTable = alias(users, 'user');

    // Drizzle select always returns an array, even if there is only one row (or limit 1)
    // Use array destructuring to extract the user object
    const [user] = await this.db
      .select({ isSuperAdmin: userTable.isSuperAdmin })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    return user?.isSuperAdmin ?? false;
  }
}
