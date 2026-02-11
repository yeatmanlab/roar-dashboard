import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { taskVariantParameters, type TaskVariantParameter } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

export class TaskVariantParameterRepository extends BaseRepository<TaskVariantParameter, typeof taskVariantParameters> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, taskVariantParameters);
  }

  /**
   * Example method to retrieve all parameters for a given task variant.
   * This may be expanded or modified in future development.
   */
  async getByTaskVariantId(taskVariantId: string): Promise<TaskVariantParameter[]> {
    const results = await this.get({
      where: eq(taskVariantParameters.taskVariantId, taskVariantId),
    });

    return results;
  }

  /**
   * Example method to retrieve a specific parameter by task variant ID and parameter name.
   * This demonstrates querying by composite key.
   */
  async getByTaskVariantIdAndName(taskVariantId: string, name: string): Promise<TaskVariantParameter | null> {
    const whereClause = and(
      eq(taskVariantParameters.taskVariantId, taskVariantId),
      eq(taskVariantParameters.name, name),
    );
    // The `and()` function can return `undefined` but the `get` overload with `where` clause must be of type SQL
    if (!whereClause) return null;

    const results = await this.get({ where: whereClause });
    return results[0] ?? null;
  }
}
