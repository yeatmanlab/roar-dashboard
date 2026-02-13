import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
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
}
