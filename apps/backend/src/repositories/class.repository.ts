import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { classes, type Class } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

export class ClassRepository extends BaseRepository<Class, typeof classes> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, classes);
  }
}
