/**
 * Test Server Entrypoint
 *
 * Dedicated server for SDK integration tests and Cypress e2e runs.
 * Composes existing backend test-support utilities into a runnable server
 * without modifying production code.
 *
 * This server:
 * 1. Initializes database pools and runs migrations
 * 2. Truncates all tables and seeds baseFixture test data
 * 3. Initializes OpenFGA store, deploys authorization model, and syncs tuples
 * 4. Swaps `AuthService.provider` for either:
 *    - `TestAuthProvider` (default): token string == Firebase UID, no
 *      signature verification. Used by SDK integration tests.
 *    - `FirebaseAuthProvider`: real Admin SDK verification, pointed at the
 *      Firebase Auth emulator when `FIREBASE_AUTH_EMULATOR_HOST` is set.
 *      Used by Cypress e2e so the auth path mirrors production.
 * 5. Seeds the Firebase Auth emulator (when in emulator mode) with users
 *    mirroring baseFixture's authIds, and writes a Cypress-side fixture
 *    file with the deterministic credentials
 * 6. Writes the SDK fixture data to a temp JSON file for SDK tests to discover
 * 7. Starts Express server on the specified port
 *
 * Environment variables:
 * - PORT: Server port (default: 4000)
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:8080)
 * - TEST_FIXTURE_FILE: Path to write SDK fixture JSON (default: /tmp/roar-test-fixture.json)
 * - FIREBASE_AUTH_EMULATOR_HOST: When set, switches to real Firebase Admin
 *   SDK verification against the emulator, seeds emulator users, and writes
 *   the Cypress fixture file
 * - CYPRESS_FIXTURE_FILE: Path to write Cypress fixture JSON (default: /tmp/roar-cypress-fixture.json).
 *   Ignored when `FIREBASE_AUTH_EMULATOR_HOST` is not set.
 *
 * Usage:
 *   NODE_ENV=production node dist/server-test.js
 */

import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import type { Express } from 'express';
import type { TestFixture } from '@roar-platform/api-contract/test-fixture.type';
import { initializeDatabasePools, closeDatabasePools, AssessmentDbClient } from './db/clients';
import { truncateAllTables, runMigrations, setupFdwForTests } from './test-support/db';
import { seedBaseFixture, type BaseFixture } from './test-support/fixtures';
import { AgreementFactory } from './test-support/factories/agreement.factory';
import { AgreementVersionFactory } from './test-support/factories/agreement-version.factory';
import { AdministrationAgreementFactory } from './test-support/factories/administration-agreement.factory';
import { AdministrationTaskVariantFactory } from './test-support/factories/administration-task-variant.factory';
import { TaskFactory } from './test-support/factories/task.factory';
import { TaskVariantFactory } from './test-support/factories/task-variant.factory';
import { TaskVariantParameterFactory } from './test-support/factories/task-variant-parameter.factory';
import { TaskBundleFactory } from './test-support/factories/task-bundle.factory';
import { TaskBundleVariantFactory } from './test-support/factories/task-bundle-variant.factory';
import { UserFactory } from './test-support/factories/user.factory';
import { UserClassFactory } from './test-support/factories/user-class.factory';
import { RunFactory } from './test-support/factories/run.factory';
import { RunScoreFactory } from './test-support/factories/run-score.factory';
import { runTrials } from './db/schema/assessment';
import { UserRole } from './enums/user-role.enum';
import { UserType } from './enums/user-type.enum';
import { SCORE_TYPE, SCORE_DOMAIN, SCORE_NAME, ASSESSMENT_STAGE } from './constants/run-scores';
import { initializeFgaTestStore, syncFgaTuplesFromPostgres } from './test-support/fga';
import {
  seedFirebaseAuthEmulator,
  type SeedableEmulatorUser,
  type SeededEmulatorUser,
} from './test-support/firebase-emulator';
import { AuthService } from './services/auth/auth.service';
import { TestAuthProvider } from './services/auth/providers/test-auth.provider';
import { FirebaseAuthProvider } from './services/auth/providers/firebase-auth.provider';
import { logger } from './logger';

const {
  PORT = '4000',
  TEST_FIXTURE_FILE = '/tmp/roar-test-fixture.json',
  CYPRESS_FIXTURE_FILE = '/tmp/roar-cypress-fixture.json',
} = process.env;

/**
 * Which baseFixture users to seed into the Firebase Auth emulator and expose
 * in the Cypress fixture file. Each key here becomes a logical user name that
 * Cypress can pass to `cy.loginAsTestUser(...)`. Adding a new tier of user
 * means: extend `baseFixture` (or pick an existing one), add the key here,
 * and migration specs can sign in as that user.
 */
const CYPRESS_FIXTURE_USER_KEYS = [
  'superAdmin',
  'districtAdmin',
  'schoolAAdmin',
  'schoolATeacher',
  'schoolAStudent',
  'classATeacher',
  'classAStudent',
  'groupStudent',
  'districtBAdmin',
] as const satisfies ReadonlyArray<keyof BaseFixture>;

// This server is run with NODE_ENV=production to exercise the built artifact, which makes
// ALLOWED_ORIGINS a required var (parseAllowedOrigins throws when it is unset in production).
// Default it to localhost so the test harness boots; SDK requests are server-to-server, so the
// CORS allowlist value is irrelevant here. A real deployment must still set ALLOWED_ORIGINS.
if (!process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS = 'https://localhost:5173';
}

let server: http.Server;

/**
 * Swap the AuthService provider based on whether we're booting against the
 * Firebase Auth emulator.
 *
 * - With `FIREBASE_AUTH_EMULATOR_HOST` set: use the real
 *   `FirebaseAuthProvider`. The Admin SDK detects the emulator host and
 *   skips signature verification on emulator-issued tokens, so Cypress can
 *   sign in via the Firebase Web SDK and have the resulting ID token verify
 *   through the same code path as production.
 * - Otherwise: use `TestAuthProvider` (token string == Firebase UID). This
 *   is the path the assessment SDK integration tests take.
 */
function mockAuthService(): void {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // @ts-expect-error Accessing private static field for testing purposes
    AuthService.provider = new FirebaseAuthProvider();
    logger.info('[server-test] AuthService using FirebaseAuthProvider (emulator mode)');
  } else {
    // @ts-expect-error Accessing private static field for testing purposes
    AuthService.provider = new TestAuthProvider();
    logger.info('[server-test] AuthService using TestAuthProvider (UID-as-token mode)');
  }
}

/**
 * Collect the subset of baseFixture users that should be seeded into the
 * Firebase Auth emulator and exposed in the Cypress fixture.
 *
 * Throws if any selected user is missing an `authId`. The DB schema allows
 * `authId` to be null (rostering can produce users with no Firebase tie
 * yet), but every key in `CYPRESS_FIXTURE_USER_KEYS` points at a `baseFixture`
 * row that the factory always populates. A null here is therefore a fixture
 * regression worth failing loudly on rather than silently skipping.
 */
function collectSeedableUsers(fixture: BaseFixture): SeedableEmulatorUser[] {
  return CYPRESS_FIXTURE_USER_KEYS.map((key) => {
    const user = fixture[key];
    if (!user.authId) {
      throw new Error(`[server-test] Fixture user "${key}" has no authId — cannot seed Firebase Auth emulator`);
    }
    return {
      authId: user.authId,
      nameFirst: user.nameFirst,
      nameLast: user.nameLast,
    };
  });
}

/**
 * Write the Cypress fixture file with one entry per seeded user.
 *
 * Cypress reads this from `/tmp/roar-cypress-fixture.json` (or
 * `CYPRESS_FIXTURE_FILE`) to resolve a fixture key like 'schoolATeacher' to
 * the email + password pair the helper uses to sign in via the Firebase
 * Auth emulator.
 */
function writeCypressFixtureFile(fixture: BaseFixture, seeded: SeededEmulatorUser[], fixtureFile: string): void {
  const byAuthId = new Map(seeded.map((u) => [u.authId, u]));

  const users = Object.fromEntries(
    CYPRESS_FIXTURE_USER_KEYS.map((key) => {
      const user = fixture[key];
      // `collectSeedableUsers` already threw if any selected user had a null
      // authId, so this re-check is defensive — and it narrows `user.authId`
      // from `string | null` to `string` for the Map lookup below.
      if (!user.authId) {
        throw new Error(`[server-test] Fixture user "${key}" has no authId`);
      }
      const creds = byAuthId.get(user.authId);
      if (!creds) {
        throw new Error(`[server-test] Missing seeded credentials for fixture key "${key}"`);
      }
      return [
        key,
        {
          id: user.id,
          authId: user.authId,
          email: creds.email,
          password: creds.password,
          nameFirst: user.nameFirst,
          nameLast: user.nameLast,
          userType: user.userType,
        },
      ];
    }),
  );

  fs.writeFileSync(fixtureFile, JSON.stringify({ users }, null, 2));
  logger.info({ fixtureFile, userCount: seeded.length }, '[server-test] Cypress fixture written');
}

/**
 * Write fixture data to a JSON file for SDK tests to discover.
 *
 * This avoids the race condition of the dynamic import in routes/index.ts
 * and keeps test infrastructure out of production code.
 *
 * @param fixtureFile - Path to write the fixture JSON file
 */
async function writeFixtureFile(fixtureFile: string): Promise<void> {
  const { baseFixture } = await import('./test-support/fixtures');

  if (!baseFixture) {
    throw new Error('[server-test] baseFixture not seeded');
  }

  if (!baseFixture.schoolAStudent.authId) {
    throw new Error('[server-test] schoolAStudent.authId not seeded');
  }

  if (!baseFixture.schoolATeacher.authId) {
    throw new Error('[server-test] schoolATeacher.authId not seeded');
  }

  const fixtureData: TestFixture = {
    testUser: {
      id: baseFixture.schoolAStudent.id,
      authId: baseFixture.schoolAStudent.authId,
    },
    schoolATeacher: {
      id: baseFixture.schoolATeacher.id,
      authId: baseFixture.schoolATeacher.authId,
    },
    administrationAssignedToDistrict: {
      id: baseFixture.administrationAssignedToDistrict.id,
    },
    administrationAssignedToDistrictB: {
      id: baseFixture.administrationAssignedToDistrictB.id,
    },
    variantForAllGrades: { id: baseFixture.variantForAllGrades.id },
    variantForGrade5: { id: baseFixture.variantForGrade5.id },
    variantForGrade3: { id: baseFixture.variantForGrade3.id },
    variantOptionalForEll: { id: baseFixture.variantOptionalForEll.id },
    variantForTask2: { id: baseFixture.variantForTask2.id },
    variantForTask2Grade5OptionalEll: { id: baseFixture.variantForTask2Grade5OptionalEll.id },
  };

  fs.writeFileSync(fixtureFile, JSON.stringify(fixtureData, null, 2));
  logger.info({ fixtureFile }, '[server-test] Fixture data written');
}

/**
 * Handle server "error" events gracefully.
 *
 * @param error - The error object
 * @param port - The port number
 */
function onError(error: NodeJS.ErrnoException, port: number): void {
  if (error.syscall !== 'listen') throw error;

  const bind = `Port ${port}`;

  switch (error.code) {
    case 'EACCES':
      logger.fatal({ port, code: error.code }, `${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.fatal({ port, code: error.code }, `${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Handle server "listening" events.
 */
function onListening(): void {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${String(addr?.port)}`;
  logger.info(`[server-test] Server is listening on ${bind}`);
}

async function startTestServer(): Promise<void> {
  try {
    // 1. Validate required environment variables
    const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`[server-test] Missing required env var: ${key}`);
      }
    }

    logger.info('[server-test] Initializing test server...');

    // 2. Initialize database pools
    logger.info('[server-test] Initializing database pools...');
    await initializeDatabasePools();

    // 3. Provision FDW prerequisites (extension, assessment_server, user mappings).
    // Required before migrations because migration 0056 creates foreign tables that
    // reference assessment_server. Uses a TS helper rather than shelling out to
    // scripts/setup-fdw-local.sh so this works in environments without psql on the
    // PATH (notably the cypress/browsers e2e CI container).
    logger.info('[server-test] Provisioning FDW prerequisites...');
    await setupFdwForTests();

    // 4. Run migrations
    logger.info('[server-test] Running migrations...');
    await runMigrations();

    // 5. Truncate all tables and seed baseFixture
    logger.info('[server-test] Truncating tables and seeding baseFixture...');
    await truncateAllTables();
    const fixture = await seedBaseFixture();

    // 5b. Seed consent/assent agreements for local dev (kept out of baseFixture so
    // the integration suite is unaffected) and assign them to the District
    // administration. This populates the dashboard's consent picker and lets the
    // edit-mode pre-fill path be exercised. The School A administration is left
    // without agreements so the "No Consent" pre-fill path is testable too.
    logger.info('[server-test] Seeding local-dev consent/assent agreements...');
    const [consentAgreement, assentAgreement] = await Promise.all([
      AgreementFactory.create({ name: 'Local Dev Consent', agreementType: 'consent' }),
      AgreementFactory.create({ name: 'Local Dev Assent', agreementType: 'assent' }),
    ]);
    await Promise.all([
      AgreementVersionFactory.create(
        { locale: 'en-US', githubFilename: 'CONSENT.md' },
        { transient: { agreementId: consentAgreement.id } },
      ),
      AgreementVersionFactory.create(
        { locale: 'en-US', githubFilename: 'ASSENT.md' },
        { transient: { agreementId: assentAgreement.id } },
      ),
      AdministrationAgreementFactory.create(undefined, {
        transient: { administrationId: fixture.administrationAssignedToDistrict.id, agreementId: consentAgreement.id },
      }),
      AdministrationAgreementFactory.create(undefined, {
        transient: { administrationId: fixture.administrationAssignedToDistrict.id, agreementId: assentAgreement.id },
      }),
    ]);

    // 5c. Seed a fuller, nicely-named assessment catalog for local dev (kept out of baseFixture
    // so the integration suite is unaffected). baseFixture defines two tasks — Word and Sentence —
    // with the variants the integration tests rely on; here we add the remaining ROAR-style tasks
    // (Phoneme, Letter, Morphology, Syntax, Inference) so the administration-form assessment picker
    // lists a realistic catalog, and give every non-district administration a distinct, tidy set of
    // assessments so the dashboard cards show a clean list of task names.
    logger.info('[server-test] Seeding local-dev tasks and assessments...');
    const [phonemeTask, letterTask, morphologyTask, syntaxTask, inferenceTask] = await Promise.all([
      TaskFactory.create({ name: 'Phoneme' }),
      TaskFactory.create({ name: 'Letter' }),
      TaskFactory.create({ name: 'Morphology' }),
      TaskFactory.create({ name: 'Syntax' }),
      TaskFactory.create({ name: 'Inference' }),
    ]);
    const [phonemeVariant, letterVariant, morphologyVariant, syntaxVariant, inferenceVariant] = await Promise.all([
      TaskVariantFactory.create({ taskId: phonemeTask.id, name: 'Phoneme (Standard)' }),
      TaskVariantFactory.create({ taskId: letterTask.id, name: 'Letter (Standard)' }),
      TaskVariantFactory.create({ taskId: morphologyTask.id, name: 'Morphology (Standard)' }),
      TaskVariantFactory.create({ taskId: syntaxTask.id, name: 'Syntax (Standard)' }),
      TaskVariantFactory.create({ taskId: inferenceTask.id, name: 'Inference (Standard)' }),
    ]);

    // Seed a handful of illustrative parameters per local-dev variant so the super-admin
    // "view params" popover on the administration card shows real rows. Parameters live in
    // their own table (task_variant_parameters), resolved by GET /tasks/:taskId/variants/:variantId.
    // Cover the new catalog variants plus the two reused baseFixture variants so every card's
    // assessments have parameters to display.
    const localDevVariantIds = [
      phonemeVariant.id,
      letterVariant.id,
      morphologyVariant.id,
      syntaxVariant.id,
      inferenceVariant.id,
      fixture.variantForAllGrades.id,
      fixture.variantForTask2.id,
    ];
    await Promise.all(
      localDevVariantIds.flatMap((taskVariantId) => [
        TaskVariantParameterFactory.create({ taskVariantId, name: 'numberOfTrials', value: 30 }),
        TaskVariantParameterFactory.create({ taskVariantId, name: 'language', value: 'en' }),
        TaskVariantParameterFactory.create({ taskVariantId, name: 'adaptive', value: true }),
      ]),
    );

    // Seed a few task bundles (the picker catalog) so the create-administration TaskPicker's
    // bundle list isn't empty locally. Bundles group variants via the task_bundle_variants
    // junction; GET /task-bundles?embed=taskVariantDetails resolves them for the picker.
    const [earlyLiteracyBundle, languageReasoningBundle, comprehensiveBundle] = await Promise.all([
      TaskBundleFactory.create({
        slug: 'early-literacy-screener',
        name: 'Early Literacy Screener',
        description: 'Foundational decoding skills: phoneme awareness, letter knowledge, and word reading.',
      }),
      TaskBundleFactory.create({
        slug: 'language-and-reasoning',
        name: 'Language & Reasoning',
        description: 'Morphology, syntax, and inference for comprehension-focused assessment.',
      }),
      TaskBundleFactory.create({
        slug: 'comprehensive-battery',
        name: 'Comprehensive Battery',
        description: 'A broad mix spanning decoding, sentence reading, and comprehension.',
      }),
    ]);
    const localDevBundleVariants: Array<{ taskBundleId: string; taskVariantId: string; sortOrder: number }> = [
      { taskBundleId: earlyLiteracyBundle.id, taskVariantId: phonemeVariant.id, sortOrder: 0 },
      { taskBundleId: earlyLiteracyBundle.id, taskVariantId: letterVariant.id, sortOrder: 1 },
      { taskBundleId: earlyLiteracyBundle.id, taskVariantId: fixture.variantForAllGrades.id, sortOrder: 2 },
      { taskBundleId: languageReasoningBundle.id, taskVariantId: morphologyVariant.id, sortOrder: 0 },
      { taskBundleId: languageReasoningBundle.id, taskVariantId: syntaxVariant.id, sortOrder: 1 },
      { taskBundleId: languageReasoningBundle.id, taskVariantId: inferenceVariant.id, sortOrder: 2 },
      { taskBundleId: comprehensiveBundle.id, taskVariantId: phonemeVariant.id, sortOrder: 0 },
      { taskBundleId: comprehensiveBundle.id, taskVariantId: fixture.variantForTask2.id, sortOrder: 1 },
      { taskBundleId: comprehensiveBundle.id, taskVariantId: inferenceVariant.id, sortOrder: 2 },
    ];
    await Promise.all(
      localDevBundleVariants.map(({ taskBundleId, taskVariantId, sortOrder }) =>
        TaskBundleVariantFactory.create({ taskBundleId, taskVariantId, sortOrder }),
      ),
    );

    // Each non-district administration gets a distinct mix so its card shows a clean list of task
    // names. Word/Sentence variants are reused from baseFixture; the rest are the new tasks above.
    const localDevAssignments: Array<{ administrationId: string; taskVariantId: string }> = [
      // School A → Word, Phoneme, Letter
      { administrationId: fixture.administrationAssignedToSchoolA.id, taskVariantId: fixture.variantForAllGrades.id },
      { administrationId: fixture.administrationAssignedToSchoolA.id, taskVariantId: phonemeVariant.id },
      { administrationId: fixture.administrationAssignedToSchoolA.id, taskVariantId: letterVariant.id },
      // School B → Sentence, Morphology, Syntax
      { administrationId: fixture.administrationAssignedToSchoolB.id, taskVariantId: fixture.variantForTask2.id },
      { administrationId: fixture.administrationAssignedToSchoolB.id, taskVariantId: morphologyVariant.id },
      { administrationId: fixture.administrationAssignedToSchoolB.id, taskVariantId: syntaxVariant.id },
      // Class A → Word, Inference
      { administrationId: fixture.administrationAssignedToClassA.id, taskVariantId: fixture.variantForAllGrades.id },
      { administrationId: fixture.administrationAssignedToClassA.id, taskVariantId: inferenceVariant.id },
      // Group → Phoneme, Morphology
      { administrationId: fixture.administrationAssignedToGroup.id, taskVariantId: phonemeVariant.id },
      { administrationId: fixture.administrationAssignedToGroup.id, taskVariantId: morphologyVariant.id },
      // District B → Letter, Syntax, Inference
      { administrationId: fixture.administrationAssignedToDistrictB.id, taskVariantId: letterVariant.id },
      { administrationId: fixture.administrationAssignedToDistrictB.id, taskVariantId: syntaxVariant.id },
      { administrationId: fixture.administrationAssignedToDistrictB.id, taskVariantId: inferenceVariant.id },
    ];

    // orderIndex is per-administration; assign it incrementally as we walk the list.
    const orderIndexByAdministration = new Map<string, number>();
    await Promise.all(
      localDevAssignments.map(({ administrationId, taskVariantId }) => {
        const orderIndex = orderIndexByAdministration.get(administrationId) ?? 0;
        orderIndexByAdministration.set(administrationId, orderIndex + 1);
        return AdministrationTaskVariantFactory.create({ administrationId, taskVariantId, orderIndex });
      }),
    );

    // 5d. Seed assessment activity (runs + scores + trials) for local dev so the dashboard's
    // completion bars and score reports aren't empty. Assessment data lives in the assessment DB
    // (read back over the FDW) and is unused by the integration suite, which seeds its own runs
    // per-test — so this is purely additive local-dev data. Wrapped so a hiccup here never blocks
    // the rest of the stack from booting; worst case the bars stay grey and the error is logged.
    try {
      logger.info('[server-test] Seeding local-dev assessment activity (runs, scores, trials)...');

      // baseFixture places District B's only student on the district org, leaving the school and
      // class beneath it with no assignees (hence no completion bars). Add students at the CLASS
      // level — the ROAR model enrolls students on a class and derives their school/district from
      // the class's org path at query time — so the class, its school, and the district all light up.
      const [cedarClassStudentA, cedarClassStudentB, cedarClassStudentC] = await Promise.all([
        UserFactory.create({ nameFirst: 'Cedar Grade 5', nameLast: 'Student One', userType: UserType.STUDENT }),
        UserFactory.create({ nameFirst: 'Cedar Grade 5', nameLast: 'Student Two', userType: UserType.STUDENT }),
        UserFactory.create({ nameFirst: 'Cedar Grade 5', nameLast: 'Student Three', userType: UserType.STUDENT }),
      ]);
      await Promise.all([
        UserClassFactory.create({
          userId: cedarClassStudentA.id,
          classId: fixture.classInDistrictB.id,
          role: UserRole.STUDENT,
        }),
        UserClassFactory.create({
          userId: cedarClassStudentB.id,
          classId: fixture.classInDistrictB.id,
          role: UserRole.STUDENT,
        }),
        UserClassFactory.create({
          userId: cedarClassStudentC.id,
          classId: fixture.classInDistrictB.id,
          role: UserRole.STUDENT,
        }),
      ]);

      const seededRunAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Create one run per (student, variant). Completed runs also get a couple of scores and
      // trials so the Scores report and individual-student views have something to render.
      const seedRun = async (
        userId: string,
        variant: { taskId: string; taskVariantId: string },
        administrationId: string,
        completed: boolean,
      ): Promise<void> => {
        const run = await RunFactory.create({
          userId,
          taskId: variant.taskId,
          taskVariantId: variant.taskVariantId,
          administrationId,
          useForReporting: true,
          completedAt: completed ? seededRunAt : null,
        });
        if (!completed) return;
        await Promise.all([
          RunScoreFactory.create({
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE_RAW,
            value: (Math.random() * 2 - 1).toFixed(3),
            assessmentStage: ASSESSMENT_STAGE.TEST,
          }),
          RunScoreFactory.create({
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.NUM_ATTEMPTED,
            value: String(20 + Math.floor(Math.random() * 20)),
            assessmentStage: ASSESSMENT_STAGE.TEST,
          }),
          AssessmentDbClient.insert(runTrials).values([
            {
              runId: run.id,
              assessmentStage: ASSESSMENT_STAGE.TEST,
              trialIndex: 0,
              correct: 1,
              stimulus: 'cat',
              response: 'cat',
              responseTimeMs: 820,
            },
            {
              runId: run.id,
              assessmentStage: ASSESSMENT_STAGE.TEST,
              trialIndex: 1,
              correct: 0,
              stimulus: 'dog',
              response: 'dig',
              responseTimeMs: 1110,
            },
          ]),
        ]);
      };

      // Per administration: which assigned students complete vs. start, over which assigned
      // variants. Students with no run here stay "assigned" (grey), so each bar shows a mix.
      // Completion is deduped per task, so completing the unconditional variant marks the task done.
      const activityPlan: Array<{
        administrationId: string;
        variants: Array<{ taskId: string; taskVariantId: string }>;
        completed: string[];
        started: string[];
      }> = [
        {
          administrationId: fixture.administrationAssignedToDistrict.id,
          variants: [
            { taskId: fixture.task.id, taskVariantId: fixture.variantForAllGrades.id },
            { taskId: fixture.task2.id, taskVariantId: fixture.variantForTask2.id },
          ],
          completed: [fixture.schoolAStudent.id, fixture.grade5Student.id],
          started: [fixture.classAStudent.id, fixture.grade3Student.id],
        },
        {
          administrationId: fixture.administrationAssignedToSchoolA.id,
          variants: [
            { taskId: fixture.task.id, taskVariantId: fixture.variantForAllGrades.id },
            { taskId: phonemeTask.id, taskVariantId: phonemeVariant.id },
            { taskId: letterTask.id, taskVariantId: letterVariant.id },
          ],
          completed: [fixture.schoolAStudent.id],
          started: [fixture.classAStudent.id],
        },
        {
          administrationId: fixture.administrationAssignedToSchoolB.id,
          variants: [
            { taskId: fixture.task2.id, taskVariantId: fixture.variantForTask2.id },
            { taskId: morphologyTask.id, taskVariantId: morphologyVariant.id },
            { taskId: syntaxTask.id, taskVariantId: syntaxVariant.id },
          ],
          completed: [fixture.schoolBStudent.id],
          started: [],
        },
        {
          administrationId: fixture.administrationAssignedToClassA.id,
          variants: [
            { taskId: fixture.task.id, taskVariantId: fixture.variantForAllGrades.id },
            { taskId: inferenceTask.id, taskVariantId: inferenceVariant.id },
          ],
          completed: [fixture.classAStudent.id],
          started: [],
        },
        {
          administrationId: fixture.administrationAssignedToGroup.id,
          variants: [
            { taskId: phonemeTask.id, taskVariantId: phonemeVariant.id },
            { taskId: morphologyTask.id, taskVariantId: morphologyVariant.id },
          ],
          completed: [fixture.groupStudent.id],
          started: [],
        },
        {
          administrationId: fixture.administrationAssignedToDistrictB.id,
          variants: [
            { taskId: letterTask.id, taskVariantId: letterVariant.id },
            { taskId: syntaxTask.id, taskVariantId: syntaxVariant.id },
            { taskId: inferenceTask.id, taskVariantId: inferenceVariant.id },
          ],
          completed: [cedarClassStudentA.id, fixture.districtBStudent.id],
          started: [cedarClassStudentB.id, cedarClassStudentC.id],
        },
      ];

      for (const plan of activityPlan) {
        await Promise.all([
          ...plan.completed.flatMap((userId) =>
            plan.variants.map((variant) => seedRun(userId, variant, plan.administrationId, true)),
          ),
          ...plan.started.flatMap((userId) =>
            plan.variants.map((variant) => seedRun(userId, variant, plan.administrationId, false)),
          ),
        ]);
      }
    } catch (err) {
      logger.warn(
        { err },
        '[server-test] local-dev assessment activity seeding failed (non-fatal); completion bars may stay empty',
      );
    }

    // 6. Initialize FGA store, deploy model, and sync tuples
    logger.info('[server-test] Initializing FGA test store...');
    await initializeFgaTestStore();

    logger.info('[server-test] Syncing FGA tuples from Postgres...');
    await syncFgaTuplesFromPostgres();

    // 7. Swap AuthService.provider (chooses FirebaseAuthProvider when
    // FIREBASE_AUTH_EMULATOR_HOST is set; TestAuthProvider otherwise).
    logger.info('[server-test] Configuring AuthService provider...');
    mockAuthService();

    // 8. In emulator mode, seed the Firebase Auth emulator with users
    // matching baseFixture.authId and write the Cypress fixture file.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      logger.info('[server-test] Seeding Firebase Auth emulator...');
      const seedable = collectSeedableUsers(fixture);
      const seeded = await seedFirebaseAuthEmulator(seedable);
      writeCypressFixtureFile(fixture, seeded, CYPRESS_FIXTURE_FILE);
    }

    // 9. Write fixture data to file
    logger.info('[server-test] Writing fixture data to file...');
    await writeFixtureFile(TEST_FIXTURE_FILE);

    // 10. Dynamic import app AFTER all setup is complete
    logger.info('[server-test] Importing Express app...');
    const { default: app }: { default: Express } = await import('./app');

    // 11. Start HTTP server
    const port = parseInt(PORT, 10);
    app.set('port', port);

    server = http.createServer(app);
    server.listen(port, () => {
      logger.info(`[server-test] HTTP server listening on http://0.0.0.0:${port}`);
    });

    server.on('error', (err) => onError(err, port));
    server.on('listening', onListening);

    // 12. Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info(`[server-test] ${signal} received: shutting down server`);
      server.close(() => {
        closeDatabasePools()
          .then(() => {
            logger.info('[server-test] Server shutdown complete');
            process.exit(0);
          })
          .catch((err) => {
            logger.error({ err }, '[server-test] Error closing database pools');
            process.exit(1);
          });
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, '[server-test] Failed to start test server');
    process.exit(1);
  }
}

startTestServer();
