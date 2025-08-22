import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import type { Config } from "drizzle-kit";

export default defineConfig({
  out: './migrations/app',
  schema: './src/db/schema-app.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.APP_DATABASE_URL!,
  },
}) satisfies Config;