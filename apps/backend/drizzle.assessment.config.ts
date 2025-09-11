import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import type { Config } from 'drizzle-kit';

export default defineConfig({
  out: './migrations/assessment',
  schema: './src/db/schema/assessment/index.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.ASSESSMENT_DATABASE_URL!,
  },
}) satisfies Config;
