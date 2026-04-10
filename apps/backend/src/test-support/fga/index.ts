/**
 * FGA Test Infrastructure
 *
 * Manages OpenFGA store lifecycle for integration tests:
 *  - `initializeFgaTestStore()` — called once in globalSetup to create the first store + model
 *  - `resetFgaStoreForTestFile()` — called per test file in vitest.setup.ts for isolation
 *  - `cleanupFgaTestStores()` — called in globalTeardown to delete all created stores
 *  - `syncFgaTuplesFromPostgres()` — called after Postgres seeding to populate FGA tuples
 */
import { OpenFgaClient } from '@openfga/sdk';
import type { AuthorizationModel } from '@openfga/sdk';
import { transformer } from '@openfga/syntax-transformer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FgaClient } from '../../clients/fga.client';
import { AuthorizationModule } from '../../services/system/authorization/authorization.module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Cached parsed model JSON — read once, reused for every store reset. */
let cachedModelJson: Omit<AuthorizationModel, 'id'> | null = null;

/** Track all created store IDs for cleanup in globalTeardown. */
const createdStoreIds: string[] = [];

/**
 * Read and parse the FGA DSL model file.
 *
 * Caches the result so subsequent calls (per-file store resets) don't re-read the file.
 *
 * @returns The parsed authorization model JSON
 */
function getModelJson(): Omit<AuthorizationModel, 'id'> {
  if (cachedModelJson) return cachedModelJson;

  const dslPath = path.resolve(__dirname, '../../../../../packages/authz/authorization-model.fga');
  const dsl = fs.readFileSync(dslPath, 'utf-8');
  cachedModelJson = transformer.transformDSLToJSONObject(dsl);
  return cachedModelJson;
}

/**
 * Create a new FGA store with the authorization model deployed.
 *
 * Sets `FGA_STORE_ID` and `FGA_MODEL_ID` env vars so that `FgaClient.getClient()`
 * picks up the new store. Clears the FgaClient singleton cache to force re-initialization.
 *
 * @param apiUrl - The OpenFGA server URL
 * @param storeName - A descriptive name for the store
 */
async function createStoreWithModel(apiUrl: string, storeName: string): Promise<void> {
  const modelJson = getModelJson();

  const client = new OpenFgaClient({ apiUrl });
  const store = await client.createStore({ name: storeName });

  const modelClient = new OpenFgaClient({ apiUrl, storeId: store.id });
  const model = await modelClient.writeAuthorizationModel(modelJson);

  process.env.FGA_STORE_ID = store.id;
  process.env.FGA_MODEL_ID = model.authorization_model_id;

  FgaClient.clearCache();
  createdStoreIds.push(store.id);
}

/**
 * Initialize the FGA test store.
 *
 * Called once in `vitest.integration.globalSetup.ts` after migrations.
 * Creates the first store, deploys the model, and sets env vars.
 */
export async function initializeFgaTestStore(): Promise<void> {
  const apiUrl = process.env.FGA_API_URL || 'http://localhost:8080';
  process.env.FGA_API_URL = apiUrl;

  await createStoreWithModel(apiUrl, `test-global-${Date.now()}`);
}

/**
 * Reset the FGA store for a new test file.
 *
 * Called per test file in `vitest.setup.ts` (integration block).
 * Creates a fresh store so each test file starts with an empty tuple set.
 */
export async function resetFgaStoreForTestFile(): Promise<void> {
  const apiUrl = process.env.FGA_API_URL!;
  await createStoreWithModel(apiUrl, `test-file-${Date.now()}`);
}

/**
 * Sync FGA tuples from the current Postgres state.
 *
 * Uses the production `AuthorizationModule.syncFgaStore()` to read all junction
 * tables and write the corresponding tuples to the current FGA store.
 *
 * Called after `seedBaseFixture()` in `vitest.setup.ts` and after `createTierUsers()`
 * in route integration tests.
 */
export async function syncFgaTuplesFromPostgres(): Promise<void> {
  const module = AuthorizationModule();
  await module.syncFgaStore({ userId: 'test-setup', isSuperAdmin: true }, { dryRun: false });
}

/**
 * Clean up all FGA stores created during the test run.
 *
 * Called in `vitest.integration.globalTeardown.ts`. Best-effort — failures are ignored.
 */
export async function cleanupFgaTestStores(): Promise<void> {
  const apiUrl = process.env.FGA_API_URL;
  if (!apiUrl || createdStoreIds.length === 0) return;

  const client = new OpenFgaClient({ apiUrl });
  for (const storeId of createdStoreIds) {
    try {
      await client.deleteStore({ storeId });
    } catch {
      // Best effort cleanup — don't fail the test run
    }
  }
}
