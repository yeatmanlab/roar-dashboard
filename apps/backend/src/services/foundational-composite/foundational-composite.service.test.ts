import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  FoundationalCompositeService,
  computeLpwComposite,
  computeFoundationalComposite,
} from './foundational-composite.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type {
  MockRunRepository,
  MockRunScoresRepository,
  MockTaskRepository,
  MockUserRepository,
} from '../../test-support/repositories';
import {
  createMockRunRepository,
  createMockRunScoresRepository,
  createMockTaskRepository,
  createMockUserRepository,
} from '../../test-support/repositories';
import { TaskFactory } from '../../test-support/factories/task.factory';
import type { CompositeInputScoreRow } from '../../repositories/run.repository';
import type { Transaction } from '../../repositories/interfaces/base.repository.interface';
import { ANONYMOUS_RUN_ADMINISTRATION_ID } from '../../constants/run';
import { SCORE_TYPE, SCORE_DOMAIN, SCORE_NAME } from '../../constants/run-scores';
import { logger } from '../../logger';

// --- Pure scoring math ---

describe('computeLpwComposite', () => {
  it('returns null when there are no subtests', () => {
    expect(computeLpwComposite([])).toBeNull();
  });

  it('returns (numerically) the single subtest estimate when only one is available', () => {
    // A single subtest's inverse-variance average equals its estimate, modulo float error.
    expect(computeLpwComposite([{ thetaEstimate: 1.5, thetaSE: 0.3 }])).toBeCloseTo(1.5, 10);
  });

  it('averages equally when SEs are equal', () => {
    const lpw = computeLpwComposite([
      { thetaEstimate: 2, thetaSE: 1 },
      { thetaEstimate: 4, thetaSE: 1 },
    ]);
    expect(lpw).toBeCloseTo(3, 10);
  });

  it('weights by inverse variance (1 / SE^2)', () => {
    // weights: 1/0.25 = 4 and 1/1 = 1 → (2*4 + 4*1) / 5 = 12/5 = 2.4
    const lpw = computeLpwComposite([
      { thetaEstimate: 2, thetaSE: 0.5 },
      { thetaEstimate: 4, thetaSE: 1 },
    ]);
    expect(lpw).toBeCloseTo(2.4, 10);
  });

  it('weights three subtests by inverse variance', () => {
    // weights 4, 4, 1 → (1*4 + 2*4 + 3*1) / 9 = 15/9
    const lpw = computeLpwComposite([
      { thetaEstimate: 1, thetaSE: 0.5 },
      { thetaEstimate: 2, thetaSE: 0.5 },
      { thetaEstimate: 3, thetaSE: 1 },
    ]);
    expect(lpw).toBeCloseTo(15 / 9, 10);
  });

  it('excludes subtests with a non-positive SE (avoids divide-by-zero)', () => {
    const lpw = computeLpwComposite([
      { thetaEstimate: 1, thetaSE: 0.5 },
      { thetaEstimate: 99, thetaSE: 0 },
      { thetaEstimate: 50, thetaSE: -1 },
    ]);
    expect(lpw).toBe(1);
  });

  it('returns null when every subtest has a non-positive SE', () => {
    expect(
      computeLpwComposite([
        { thetaEstimate: 1, thetaSE: 0 },
        { thetaEstimate: 2, thetaSE: -0.5 },
      ]),
    ).toBeNull();
  });

  it('excludes subtests with a non-finite estimate', () => {
    const lpw = computeLpwComposite([
      { thetaEstimate: Number.NaN, thetaSE: 0.5 },
      { thetaEstimate: 2, thetaSE: 0.5 },
    ]);
    expect(lpw).toBe(2);
  });
});

describe('computeFoundationalComposite', () => {
  it('returns null when nothing is available', () => {
    expect(computeFoundationalComposite({ lpw: [], sreTransformed: null })).toBeNull();
  });

  it('returns the LPW composite when Sentence is absent', () => {
    const result = computeFoundationalComposite({
      lpw: [{ thetaEstimate: 2, thetaSE: 0.5 }],
      sreTransformed: null,
    });
    expect(result).toBe(2);
  });

  it('blends LPW and Sentence when LPW is at or above the floor', () => {
    // LPW = 2.4 ; final = 0.514*2.4 + 0.486*1.0 = 1.7196
    const result = computeFoundationalComposite({
      lpw: [
        { thetaEstimate: 2, thetaSE: 0.5 },
        { thetaEstimate: 4, thetaSE: 1 },
      ],
      sreTransformed: 1.0,
    });
    expect(result).toBeCloseTo(1.7196, 10);
  });

  it('blends at exactly the floor (LPW = -3.03 is included)', () => {
    // LPW = -3.03 ; final = 0.514*(-3.03) + 0.486*1.0 = -1.07142
    const result = computeFoundationalComposite({
      lpw: [{ thetaEstimate: -3.03, thetaSE: 0.5 }],
      sreTransformed: 1.0,
    });
    expect(result).toBeCloseTo(-1.07142, 10);
  });

  it('falls back to LPW only when LPW is below the floor', () => {
    const result = computeFoundationalComposite({
      lpw: [{ thetaEstimate: -5, thetaSE: 0.5 }],
      sreTransformed: 1.0,
    });
    expect(result).toBeCloseTo(-5, 10);
  });

  it('returns the Sentence score alone when only Sentence is available (floor does not gate)', () => {
    expect(computeFoundationalComposite({ lpw: [], sreTransformed: 2.5 })).toBe(2.5);
    expect(computeFoundationalComposite({ lpw: [], sreTransformed: -10 })).toBe(-10);
  });
});

// --- Orchestration ---

describe('FoundationalCompositeService.recomputeForRun', () => {
  const ADMIN_ID = '660e8400-e29b-41d4-a716-446655440001';
  const USER_ID = 'user-123';
  const COMPOSITE_RUN_ID = 'composite-run-id';

  // Deterministic taskId per foundational slug for the getBySlug stub.
  const TASK_ID = {
    pa: 'task-pa',
    swr: 'task-swr',
    letter: 'task-letter',
    sre: 'task-sre',
  } as const;
  const slugToId = new Map<string, string>(Object.entries(TASK_ID));

  // A labelled test double for the assessment transaction (no real DB in unit tests).
  // recomputeForRun requires a transaction, so every call passes this.
  const tx = { __brand: 'tx' } as unknown as Transaction;
  // Fixed trigger timestamp; norming is gated off in these tests so its only role is to satisfy
  // the required param.
  const TRIGGERED_AT = new Date('2026-01-15T00:00:00Z');

  let runRepository: MockRunRepository;
  let runScoresRepository: MockRunScoresRepository;
  let taskRepository: MockTaskRepository;
  let userRepository: MockUserRepository;
  let service: ReturnType<typeof FoundationalCompositeService>;

  beforeEach(() => {
    vi.clearAllMocks();

    runRepository = createMockRunRepository();
    runScoresRepository = createMockRunScoresRepository();
    taskRepository = createMockTaskRepository();
    userRepository = createMockUserRepository();

    taskRepository.getBySlug.mockImplementation(async (slug: string) => {
      const id = slugToId.get(slug);
      return id ? TaskFactory.build({ id, slug }) : null;
    });
    runRepository.findOrCreateCompositeRun.mockResolvedValue({ id: COMPOSITE_RUN_ID });
    runScoresRepository.upsertMany.mockResolvedValue([{ id: 'score-id' }]);

    service = FoundationalCompositeService({ runRepository, runScoresRepository, taskRepository, userRepository });
  });

  const thetaRow = (
    taskId: string,
    name: string,
    value: string,
    domain: string = SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
  ): CompositeInputScoreRow => ({
    taskId,
    runId: `run-${taskId}`,
    domain,
    name,
    value,
  });

  // Sentence/SRE now writes its transformed score as `thetaEstimate` under
  // `composite_foundational`, just like the other subtests; the service routes it to the
  // Stage-2 blend by slug.
  const sreRow = (value: string): CompositeInputScoreRow => ({
    taskId: TASK_ID.sre,
    runId: 'run-sre',
    domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
    name: SCORE_NAME.THETA_ESTIMATE,
    value,
  });

  it('is a no-op for anonymous runs (no DB work)', async () => {
    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ANONYMOUS_RUN_ADMINISTRATION_ID,
      triggeringTaskId: TASK_ID.pa,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    expect(taskRepository.getBySlug).not.toHaveBeenCalled();
    expect(runRepository.lockCompositeForUpdate).not.toHaveBeenCalled();
    expect(runRepository.getReportingRunScoresForComposite).not.toHaveBeenCalled();
    expect(runRepository.findOrCreateCompositeRun).not.toHaveBeenCalled();
    expect(runScoresRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('is a no-op when the triggering run is not a foundational subtest', async () => {
    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: 'task-some-other-assessment',
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    expect(runRepository.lockCompositeForUpdate).not.toHaveBeenCalled();
    expect(runRepository.getReportingRunScoresForComposite).not.toHaveBeenCalled();
    expect(runRepository.findOrCreateCompositeRun).not.toHaveBeenCalled();
    expect(runScoresRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('computes an LPW-only composite from a single subtest and upserts it on the composite run', async () => {
    // SE = 0.5 → weight 4 → single-subtest LPW is exactly 1.5 (no float residue), so the
    // full upserted row can be asserted by exact equality below.
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.pa, 'scoringVersion', '5'),
      ],
      reportingTaskIds: [TASK_ID.pa],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.pa,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    expect(runRepository.findOrCreateCompositeRun).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, administrationId: ADMIN_ID }),
    );
    expect(runScoresRepository.upsertMany).toHaveBeenCalledTimes(1);
    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.data).toEqual([
      {
        runId: COMPOSITE_RUN_ID,
        type: SCORE_TYPE.COMPUTED,
        domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
        name: SCORE_NAME.THETA_ESTIMATE,
        value: '1.5',
        assessmentStage: null,
        categoryScore: null,
      },
    ]);
  });

  it('ignores a subtest whose thetaSE score is missing (undefined value parses to null)', async () => {
    // PA has a full theta pair; Letter has a thetaEstimate but NO thetaSE row, so parseScoreValue
    // sees `undefined` for Letter's SE and Letter is dropped from the LPW average. The composite
    // is therefore PA's 1.5, not pulled toward Letter's 3.0.
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.pa, 'scoringVersion', '5'),
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_ESTIMATE, '3.0'), // no thetaSE row for Letter
        thetaRow(TASK_ID.letter, 'scoringVersion', '1'),
      ],
      reportingTaskIds: [TASK_ID.pa, TASK_ID.letter],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.pa,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.data[0]!.value).toBe('1.5');
  });

  it('blends LPW and Sentence and forwards the transaction', async () => {
    // LPW = (1*4 + 2*4)/8 = 1.5 ; final = 0.514*1.5 + 0.486*1.0 = 1.257
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.0'),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.pa, 'scoringVersion', '5'),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_ESTIMATE, '2.0', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_SE, '0.5', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, 'scoringVersion', '7', SCORE_DOMAIN.COMPOSITE),
        sreRow('1.0'),
        thetaRow(TASK_ID.sre, 'scoringVersion', '5'),
      ],
      reportingTaskIds: [TASK_ID.pa, TASK_ID.swr, TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.swr,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    expect(runRepository.getReportingRunScoresForComposite).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, administrationId: ADMIN_ID, transaction: tx }),
    );
    // The advisory lock must be acquired (with the same tx) BEFORE the gather, so the
    // composite reads a fully-recomputed use_for_reporting snapshot.
    expect(runRepository.lockCompositeForUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, administrationId: ADMIN_ID, transaction: tx }),
    );
    expect(runRepository.lockCompositeForUpdate.mock.invocationCallOrder[0]!).toBeLessThan(
      runRepository.getReportingRunScoresForComposite.mock.invocationCallOrder[0]!,
    );
    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.transaction).toBe(tx);
    expect(Number.parseFloat(upsertArg.data[0]!.value)).toBeCloseTo(1.257, 10);
  });

  it('falls back to LPW when LPW is below the floor', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_ESTIMATE, '-5'),
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_SE, '0.3'),
        thetaRow(TASK_ID.letter, 'scoringVersion', '1'),
        sreRow('1.0'),
      ],
      reportingTaskIds: [TASK_ID.letter, TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.letter,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    expect(Number.parseFloat(runScoresRepository.upsertMany.mock.calls[0]![0].data[0]!.value)).toBeCloseTo(-5, 10);
  });

  it('uses the Sentence score alone when only Sentence was taken', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [sreRow('2.5'), thetaRow(TASK_ID.sre, 'scoringVersion', '5')],
      reportingTaskIds: [TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.sre,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    expect(Number.parseFloat(runScoresRepository.upsertMany.mock.calls[0]![0].data[0]!.value)).toBeCloseTo(2.5, 10);
  });

  it('warns (and falls back to LPW-only) when a Sentence reporting run produced no transformed score', async () => {
    // PA present; SRE has a reporting run but emitted NO composite_foundational thetaEstimate row.
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.pa, 'scoringVersion', '5'),
      ],
      reportingTaskIds: [TASK_ID.pa, TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.sre,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    // Degrades loudly, not silently.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ sreTaskId: TASK_ID.sre }) }),
      expect.stringContaining('no transformed score'),
    );
    // Composite is still written, LPW-only (1.5).
    expect(runScoresRepository.upsertMany.mock.calls[0]![0].data[0]!.value).toBe('1.5');
  });

  it('writes nothing when there are no usable inputs', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      rows: [],
      reportingTaskIds: [],
      latestCompletedAt: null,
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.pa,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    expect(runRepository.findOrCreateCompositeRun).not.toHaveBeenCalled();
    expect(runScoresRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('reads SWR from composite domain instead of composite_foundational', async () => {
    // SWR writes to both composite and composite_foundational, but the service should read
    // from composite domain specifically for SWR.
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_ESTIMATE, '2.0', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_SE, '0.5', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, 'scoringVersion', '7', SCORE_DOMAIN.COMPOSITE),
      ],
      reportingTaskIds: [TASK_ID.swr],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.swr,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.data[0]!.value).toBe('2.0');
  });

  it('skips SWR if scoringVersion is below 7', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_ESTIMATE, '2.0', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_SE, '0.5', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, 'scoringVersion', '6', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.pa, 'scoringVersion', '5', SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL),
      ],
      reportingTaskIds: [TASK_ID.swr, TASK_ID.pa],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.swr,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    // SWR is skipped (version 6 < 7), so composite should only include PA (1.5)
    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.data[0]!.value).toBe('1.5');
  });

  it('skips PA if scoringVersion is below 5', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.pa, 'scoringVersion', '4', SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_ESTIMATE, '2.0', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_SE, '0.5', SCORE_DOMAIN.COMPOSITE),
        thetaRow(TASK_ID.swr, 'scoringVersion', '7', SCORE_DOMAIN.COMPOSITE),
      ],
      reportingTaskIds: [TASK_ID.pa, TASK_ID.swr],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.pa,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    // PA is skipped (version 4 < 5), so composite should only include SWR (2.0)
    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.data[0]!.value).toBe('2.0');
  });

  it('skips SRE if scoringVersion is below 5', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.letter, 'scoringVersion', '1', SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL),
        sreRow('1.0'), // SRE without version (or version < 5)
      ],
      reportingTaskIds: [TASK_ID.letter, TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.letter,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    // Letter is included (version 1 >= 1), but SRE is skipped, so composite is LPW-only (1.5)
    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.data[0]!.value).toBe('1.5');
  });

  it('includes Letter if it has any scoringVersion (>= 1)', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      latestCompletedAt: null,
      rows: [
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.letter, 'scoringVersion', '1', SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL),
      ],
      reportingTaskIds: [TASK_ID.letter],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.letter,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

    const upsertArg = runScoresRepository.upsertMany.mock.calls[0]![0];
    expect(upsertArg.data[0]!.value).toBe('1.5');
  });

  it('wraps unexpected repository errors in a 500 ApiError', async () => {
    runRepository.getReportingRunScoresForComposite.mockRejectedValue(new Error('db down'));

    const error: unknown = await service
      .recomputeForRun({
        userId: USER_ID,
        administrationId: ADMIN_ID,
        triggeringTaskId: TASK_ID.pa,
        triggeredAt: TRIGGERED_AT,
        transaction: tx,
      })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it('re-throws an ApiError from the repository unchanged (not wrapped in a 500)', async () => {
    const apiError = new ApiError(ApiErrorMessage.FORBIDDEN, {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
    });
    runRepository.lockCompositeForUpdate.mockRejectedValue(apiError);

    const error: unknown = await service
      .recomputeForRun({
        userId: USER_ID,
        administrationId: ADMIN_ID,
        triggeringTaskId: TASK_ID.pa,
        triggeredAt: TRIGGERED_AT,
        transaction: tx,
      })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBe(apiError); // same instance — the `instanceof ApiError` branch re-throws as-is
  });
});
