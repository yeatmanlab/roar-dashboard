import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { tasks, type Task } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';
import { TaskAccessControls } from './access-controls/tasks.access-controls';

export class TaskRepository extends BaseRepository<Task, typeof tasks> {
  private readonly accessControls: TaskAccessControls;

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    accessControls: TaskAccessControls = new TaskAccessControls(db),
  ) {
    super(db, tasks);
    this.accessControls = accessControls;
  }

  async getBySlug(slug: string): Promise<Task | null> {
    const [result] = (await this.get({
      where: eq(tasks.slug, slug),
      limit: 1,
    })) as Task[];

    return result ?? null;
  }
}
