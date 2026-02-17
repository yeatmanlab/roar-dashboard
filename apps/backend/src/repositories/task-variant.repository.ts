import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { taskVariants, type TaskVariant } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

export class TaskVariantRepository extends BaseRepository<TaskVariant, typeof taskVariants> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, taskVariants);
  }

  async getTaskIdByVariantId(variantId: string): Promise<string | null> {
    const variant = await this.getById({ id: variantId });
    return variant?.taskId ?? null;
  }
}
