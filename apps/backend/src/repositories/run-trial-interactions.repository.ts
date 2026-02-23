import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AssessmentDbClient } from '../db/clients';
import type * as AssessmentDbSchema from '../db/schema/assessment';
import { BaseRepository } from './base.repository';
import { runTrialInteractions } from '../db/schema/assessment';
import type { RunTrialInteraction } from '../db/schema';

export class RunTrialInteractionsRepository extends BaseRepository<RunTrialInteraction, typeof runTrialInteractions> {
  constructor(db: NodePgDatabase<typeof AssessmentDbSchema> = AssessmentDbClient) {
    super(db, runTrialInteractions);
  }
}
