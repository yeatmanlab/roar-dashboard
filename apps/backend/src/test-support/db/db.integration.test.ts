/**
 * Smoke test to verify integration test database infrastructure works correctly.
 */
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { CoreDbClient, AssessmentDbClient } from './index';

describe('Integration Test Database Infrastructure', () => {
  it('should connect to core database', async () => {
    const result = await CoreDbClient.execute<{ one: number }>(sql`SELECT 1 as one`);
    expect(result.rows[0]?.one).toBe(1);
  });

  it('should connect to assessment database', async () => {
    const result = await AssessmentDbClient.execute<{ one: number }>(sql`SELECT 1 as one`);
    expect(result.rows[0]?.one).toBe(1);
  });

  it('should have app schema in core database', async () => {
    const result = await CoreDbClient.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app'
      ) as exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });

  it('should have app schema in assessment database', async () => {
    const result = await AssessmentDbClient.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app'
      ) as exists
    `);
    expect(result.rows[0]?.exists).toBe(true);
  });
});
