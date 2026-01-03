import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as CoreDbSchema from './schema/core';
import { logger } from '../logger';
// import * as AssessmentDbSchema from './schema/assessment';

const corePool = new Pool({
  connectionString: process.env.CORE_DATABASE_URL,
});

corePool.on('error', (err) => {
  logger.error({ err, pool: 'core' }, 'Unexpected database pool error');
});

const assessmentPool = new Pool({
  connectionString: process.env.ASSESSMENT_DATABASE_URL,
});

assessmentPool.on('error', (err) => {
  logger.error({ err, pool: 'assessment' }, 'Unexpected database pool error');
});

export const CoreDbClient = drizzle({ client: corePool, casing: 'snake_case', schema: CoreDbSchema, logger: true });
export const AssessmentDbClient = drizzle({ client: assessmentPool, casing: 'snake_case', schema: {}, logger: true });
