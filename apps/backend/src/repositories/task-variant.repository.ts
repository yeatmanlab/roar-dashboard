import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { taskVariants, type TaskVariant } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

export class TaskVariantRepository extends BaseRepository<TaskVariant, typeof taskVariants> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, taskVariants);
  }

  /**
   * Example method to retrieve all task variants for a given task.
   * This may be expanded or modified in future development.
   */
  async getByTaskId(taskId: string): Promise<TaskVariant[]> {
    const results = await this.get({
      where: eq(taskVariants.taskId, taskId),
    });

    return results as TaskVariant[];
  }
}
