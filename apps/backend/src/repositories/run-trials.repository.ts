import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import type * as AssessmentDbSchema from '../db/schema/assessment';
import { BaseRepository } from './base.repository';
import { runTrials } from '../db/schema/assessment';
import type { RunTrial } from '../db/schema';

export class RunTrialsRepository extends BaseRepository<RunTrial, typeof runTrials> {
  constructor(db: NodePgDatabase<typeof AssessmentDbSchema> = AssessmentDbClient) {
    super(db, runTrials);
  }
}
