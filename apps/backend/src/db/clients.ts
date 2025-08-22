import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const appPool = new Pool({
  connectionString: process.env.APP_DATABASE_URL,
});

const assessmentPool = new Pool({
  connectionString: process.env.ASSESSMENT_DATABASE_URL,
});
  

export const AppDbClient = drizzle(appPool);
export const AssessmentDbClient = drizzle(assessmentPool);
