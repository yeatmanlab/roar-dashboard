import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { tasks, type Task } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

export class TaskRepository extends BaseRepository<Task, typeof tasks> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, tasks);
  }

  /**
   * Example method, this may not be needed in production.
   */
  // TODO: Possibly implement an enum for slug to type against
  async getBySlug(slug: string): Promise<Task | null> {
    const [result] = (await this.get({
      where: eq(tasks.slug, slug),
      limit: 1,
    })) as Task[];

    return result ?? null;
  }
}
