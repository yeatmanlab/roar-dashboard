import { describe, it, expect, beforeEach, vi } from 'vitest';

// Flip the norming feature gate ON while keeping every other composite constant real. These
// tests cover `resolveCompositeNormRows`, which is short-circuited (and thus uncovered) by the
// default `FOUNDATIONAL_COMPOSITE_NORMING_ENABLED = false`.
vi.mock('../../constants/foundational-composite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../constants/foundational-composite')>();
  return { ...actual, FOUNDATIONAL_COMPOSITE_NORMING_ENABLED: true };
});
// Mock the table provider so no network is touched; its own behavior is unit-tested separately.
vi.mock('./composite-norm-table', () => ({ loadCompositeNormTable: vi.fn() }));

import { FoundationalCompositeService } from './foundational-composite.service';
import { loadCompositeNormTable } from './composite-norm-table';
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
import { UserFactory } from '../../test-support/factories/user.factory';
import type { Transaction } from '../../repositories/interfaces/base.repository.interface';
import { SCORE_DOMAIN, SCORE_NAME } from '../../constants/run-scores';
import { logger } from '../../logger';

const mockedLoadTable = vi.mocked(loadCompositeNormTable);

describe('FoundationalCompositeService — norming path (gate on)', () => {
  const ADMIN_ID = '660e8400-e29b-41d4-a716-446655440099';
  const USER_ID = 'user-norming-123';
  const COMPOSITE_RUN_ID = 'composite-run-id';
  const TASK_ID = { pa: 'task-pa', swr: 'task-swr', letter: 'task-letter', sre: 'task-sre' } as const;
  const slugToId = new Map<string, string>(Object.entries(TASK_ID));
  const tx = { __brand: 'tx' } as unknown as Transaction;
  // dob below makes the participant exactly 120 months old as of this trigger date.
  const TRIGGERED_AT = new Date('2026-06-20T00:00:00Z');

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
    // A single PA reporting run with an LPW theta pair → composite theta = 1.5.
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      rows: [
        {
          taskId: TASK_ID.pa,
          runId: 'run-pa',
          domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
          name: SCORE_NAME.THETA_ESTIMATE,
          value: '1.5',
        },
        {
          taskId: TASK_ID.pa,
          runId: 'run-pa',
          domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
          name: SCORE_NAME.THETA_SE,
          value: '0.5',
        },
        {
          taskId: TASK_ID.pa,
          runId: 'run-pa',
          domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
          name: 'scoringVersion',
          value: '5',
        },
      ],
      reportingTaskIds: [TASK_ID.pa],
      latestCompletedAt: null,
    });
    runRepository.findOrCreateCompositeRun.mockResolvedValue({ id: COMPOSITE_RUN_ID });
    runScoresRepository.upsertMany.mockResolvedValue([{ id: 'score-id' }]);
    userRepository.getById.mockResolvedValue(UserFactory.build({ id: USER_ID, dob: '2016-06-20', grade: '3' }));

    service = FoundationalCompositeService({ runRepository, runScoresRepository, taskRepository, userRepository });
  });

  const recompute = () =>
    service.recomputeForRun({
      userId: USER_ID,
      administrationId: ADMIN_ID,
      triggeringTaskId: TASK_ID.pa,
      triggeredAt: TRIGGERED_AT,
      transaction: tx,
    });

  const upsertedNames = () => {
    const call = runScoresRepository.upsertMany.mock.calls[0]![0];
    return call.data.map((row) => row.name);
  };

  it('writes the normed rows alongside the theta when norming resolves a row', async () => {
    mockedLoadTable.mockResolvedValue([
      { ageMonths: 120, thetaEstimate: 1.5, percentile: 60, standardScore: 104, roarScore: 500 },
    ]);

    await recompute();

    expect(runScoresRepository.upsertMany).toHaveBeenCalledTimes(1);
    const data = runScoresRepository.upsertMany.mock.calls[0]![0].data;
    expect(data.map((r) => r.name)).toEqual([
      SCORE_NAME.THETA_ESTIMATE,
      SCORE_NAME.PERCENTILE,
      SCORE_NAME.STANDARD_SCORE,
      SCORE_NAME.ROAR_SCORE,
    ]);
    expect(data.find((r) => r.name === SCORE_NAME.PERCENTILE)?.value).toBe('60');
  });

  it('keys the norm by the latest assessment date (latestCompletedAt) when it is later than the trigger', async () => {
    // The participant is 120 months old at TRIGGERED_AT (2026-06-20) but 132 at this later
    // completion date. The table only has a row at ageMonths 132, so a normed row is written
    // only if referenceDate = max(latestCompletedAt, triggeredAt) = latestCompletedAt.
    runRepository.getReportingRunScoresForComposite.mockResolvedValue({
      rows: [
        {
          taskId: TASK_ID.pa,
          runId: 'run-pa',
          domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
          name: SCORE_NAME.THETA_ESTIMATE,
          value: '1.5',
        },
        {
          taskId: TASK_ID.pa,
          runId: 'run-pa',
          domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
          name: SCORE_NAME.THETA_SE,
          value: '0.5',
        },
        {
          taskId: TASK_ID.pa,
          runId: 'run-pa',
          domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
          name: 'scoringVersion',
          value: '5',
        },
      ],
      reportingTaskIds: [TASK_ID.pa],
      latestCompletedAt: new Date('2027-06-20T00:00:00Z'),
    });
    mockedLoadTable.mockResolvedValue([{ ageMonths: 132, thetaEstimate: 1.5, percentile: 70 }]);

    await recompute();

    // Matched only because age was resolved as of 2027-06-20 (132 mo), not the earlier trigger (120 mo).
    expect(upsertedNames()).toContain(SCORE_NAME.PERCENTILE);
  });

  it('writes only the theta when the user record is missing', async () => {
    userRepository.getById.mockResolvedValue(null);
    mockedLoadTable.mockResolvedValue([{ ageMonths: 120, thetaEstimate: 1.5, percentile: 60 }]);

    await recompute();

    expect(upsertedNames()).toEqual([SCORE_NAME.THETA_ESTIMATE]);
  });

  it('writes only the theta when the table is unavailable', async () => {
    mockedLoadTable.mockResolvedValue(null);

    await recompute();

    expect(mockedLoadTable).toHaveBeenCalledTimes(1);
    expect(upsertedNames()).toEqual([SCORE_NAME.THETA_ESTIMATE]);
  });

  it('logs and writes only the theta when norming throws', async () => {
    userRepository.getById.mockRejectedValue(new Error('core db down'));

    await recompute();

    expect(upsertedNames()).toEqual([SCORE_NAME.THETA_ESTIMATE]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining('norming failed'),
    );
  });
});
