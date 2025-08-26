import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import type { Config } from 'drizzle-kit';

export default defineConfig({
  out: './migrations/assessment',
  schema: './src/db/schema-assessment.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.ASSESSMENT_DATABASE_URL!,
  },
}) satisfies Config;
