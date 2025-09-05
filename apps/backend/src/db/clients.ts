import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as CoreDbSchema from './schema/core';
// import * as AssessmentDbSchema from './schema/assessment';

const corePool = new Pool({
  connectionString: process.env.CORE_DATABASE_URL,
});

corePool.on('error', (err) => {
  // @TODO: Replace with actual logger instance.
  console.error('[DB Pool/Core] Unexpected client error', err);
});

const assessmentPool = new Pool({
  connectionString: process.env.ASSESSMENT_DATABASE_URL,
});

assessmentPool.on('error', (err) => {
  // @TODO: Replace with actual logger instance.
  console.error('[DB Pool/Assessment] Unexpected client error', err);
});

export const CoreDbClient = drizzle({ client: corePool, casing: 'snake_case', schema: CoreDbSchema, logger: true });
export const AssessmentDbClient = drizzle({ client: assessmentPool, casing: 'snake_case', schema: {}, logger: true });
