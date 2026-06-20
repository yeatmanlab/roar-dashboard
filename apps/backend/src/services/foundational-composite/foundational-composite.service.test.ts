import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  FoundationalCompositeService,
  computeLpwComposite,
  computeFoundationalComposite,
} from './foundational-composite.service';
import { ApiError } from '../../errors/api-error';
import type { MockRunRepository, MockRunScoresRepository, MockTaskRepository } from '../../test-support/repositories';
import {
  createMockRunRepository,
  createMockRunScoresRepository,
  createMockTaskRepository,
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

  it('blends LPW and Sentence when Sentence is at or above the floor', () => {
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

  it('blends at exactly the floor (-3.03 is included)', () => {
    // LPW = 2.4 ; final = 0.514*2.4 + 0.486*(-3.03) = -0.23898
    const result = computeFoundationalComposite({
      lpw: [
        { thetaEstimate: 2, thetaSE: 0.5 },
        { thetaEstimate: 4, thetaSE: 1 },
      ],
      sreTransformed: -3.03,
    });
    expect(result).toBeCloseTo(-0.23898, 10);
  });

  it('falls back to LPW only when Sentence is below the floor', () => {
    const result = computeFoundationalComposite({
      lpw: [
        { thetaEstimate: 2, thetaSE: 0.5 },
        { thetaEstimate: 4, thetaSE: 1 },
      ],
      sreTransformed: -5,
    });
    expect(result).toBeCloseTo(2.4, 10);
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

  let runRepository: MockRunRepository;
  let runScoresRepository: MockRunScoresRepository;
  let taskRepository: MockTaskRepository;
  let service: ReturnType<typeof FoundationalCompositeService>;

  beforeEach(() => {
    vi.clearAllMocks();

    runRepository = createMockRunRepository();
    runScoresRepository = createMockRunScoresRepository();
    taskRepository = createMockTaskRepository();

    taskRepository.getBySlug.mockImplementation(async (slug: string) => {
      const id = slugToId.get(slug);
      return id ? TaskFactory.build({ id, slug }) : null;
    });
    runRepository.findOrCreateCompositeRun.mockResolvedValue({ id: COMPOSITE_RUN_ID });
    runScoresRepository.upsertMany.mockResolvedValue([{ id: 'score-id' }]);

    service = FoundationalCompositeService({ runRepository, runScoresRepository, taskRepository });
  });

  const thetaRow = (taskId: string, name: string, value: string): CompositeInputScoreRow => ({
    taskId,
    runId: `run-${taskId}`,
    domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
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
      rows: [thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.5'), thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5')],
      reportingTaskIds: [TASK_ID.pa],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.pa,
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

  it('blends LPW and Sentence and forwards the transaction', async () => {
    // LPW = (1*4 + 2*4)/8 = 1.5 ; final = 0.514*1.5 + 0.486*1.0 = 1.257
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      rows: [
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.0'),
        thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5'),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_ESTIMATE, '2.0'),
        thetaRow(TASK_ID.swr, SCORE_NAME.THETA_SE, '0.5'),
        sreRow('1.0'),
      ],
      reportingTaskIds: [TASK_ID.pa, TASK_ID.swr, TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.swr,
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

  it('falls back to LPW when the Sentence score is below the floor', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      rows: [
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_ESTIMATE, '1.5'),
        thetaRow(TASK_ID.letter, SCORE_NAME.THETA_SE, '0.3'),
        sreRow('-10'),
      ],
      reportingTaskIds: [TASK_ID.letter, TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.letter,
      transaction: tx,
    });

    expect(Number.parseFloat(runScoresRepository.upsertMany.mock.calls[0]![0].data[0]!.value)).toBeCloseTo(1.5, 10);
  });

  it('uses the Sentence score alone when only Sentence was taken', async () => {
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      rows: [sreRow('2.5')],
      reportingTaskIds: [TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.sre,
      transaction: tx,
    });

    expect(Number.parseFloat(runScoresRepository.upsertMany.mock.calls[0]![0].data[0]!.value)).toBeCloseTo(2.5, 10);
  });

  it('warns (and falls back to LPW-only) when a Sentence reporting run produced no transformed score', async () => {
    // PA present; SRE has a reporting run but emitted NO composite_foundational thetaEstimate row.
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      rows: [thetaRow(TASK_ID.pa, SCORE_NAME.THETA_ESTIMATE, '1.5'), thetaRow(TASK_ID.pa, SCORE_NAME.THETA_SE, '0.5')],
      reportingTaskIds: [TASK_ID.pa, TASK_ID.sre],
    });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.sre,
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
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({ rows: [], reportingTaskIds: [] });

    await service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.pa,
      transaction: tx,
    });

    expect(runRepository.findOrCreateCompositeRun).not.toHaveBeenCalled();
    expect(runScoresRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('wraps unexpected repository errors in a 500 ApiError', async () => {
    runRepository.getReportingRunScoresForComposite.mockRejectedValue(new Error('db down'));

    const error: unknown = await service
      .recomputeForRun({ userId: USER_ID, administrationId: ADMIN_ID, triggeringTaskId: TASK_ID.pa, transaction: tx })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });
});
