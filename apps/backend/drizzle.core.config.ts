import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import type { Config } from 'drizzle-kit';

export default defineConfig({
  out: './migrations/core',
  schema: './src/db/schema/core/index.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.CORE_DATABASE_URL!,
  },
}) satisfies Config;
