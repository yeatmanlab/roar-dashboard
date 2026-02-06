import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { classes, type Class } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

export class ClassRepository extends BaseRepository<Class, typeof classes> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, classes);
  }

  /**
   * Find a class with an id
   * @param id - The class id to look up
   * @returns The class if found, null otherwise
   */
  async findById(id: string): Promise<Class | null> {
    const result = await this.get({ id });

    return result ?? null;
  }
}
