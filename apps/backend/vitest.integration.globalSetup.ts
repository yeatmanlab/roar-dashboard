/**
 * Global Setup for Integration Tests
 *
 * This runs once before any test files are loaded.
 * Used to load .env.test into process.env so DB clients connect to test databases.
 */
import { config } from 'dotenv';

export default function globalSetup() {
  // Load .env.test with override to ensure test DB URLs are used
  config({ path: '.env.test', override: true });
}
