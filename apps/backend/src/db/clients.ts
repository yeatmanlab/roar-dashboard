import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as AppDbSchema from './schema/app';
// import * as AssessmentDbSchema from './schema/assessment';

const appPool = new Pool({
  connectionString: process.env.APP_DATABASE_URL,
});

appPool.on('error', (err) => {
  // @TODO: Replace with actual logger instance.
  console.error('[DB Pool/App] Unexpected client error', err);
});

const assessmentPool = new Pool({
  connectionString: process.env.ASSESSMENT_DATABASE_URL,
});

assessmentPool.on('error', (err) => {
  // @TODO: Replace with actual logger instance.
  console.error('[DB Pool/Assessment] Unexpected client error', err);
});

export const AppDbClient = drizzle({ client: appPool, casing: 'snake_case', schema: AppDbSchema, logger: true });
export const AssessmentDbClient = drizzle({ client: assessmentPool, casing: 'snake_case', schema: {}, logger: true });
