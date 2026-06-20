import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import { RunRepository } from '../../repositories/run.repository';
import type { CompositeInputScoreRow } from '../../repositories/run.repository';
import { RunScoresRepository } from '../../repositories/run-scores.repository';
import { TaskRepository } from '../../repositories/task.repository';
import type { NewRunScore } from '../../db/schema';
import { ANONYMOUS_RUN_ADMINISTRATION_ID } from '../../constants/run';
import { SCORE_TYPE, SCORE_DOMAIN, SCORE_NAME } from '../../constants/run-scores';
import {
  FOUNDATIONAL_COMPOSITE_SLUG,
  FOUNDATIONAL_COMPOSITE_SLUGS,
  LPW_COMPOSITE_WEIGHT,
  SRE_TRANSFORMED_WEIGHT,
  SRE_TRANSFORMED_FLOOR,
} from '../../constants/foundational-composite';
import type { FoundationalCompositeSlug } from '../../constants/foundational-composite';
import type {
  FoundationalCompositeInputs,
  RecomputeFoundationalCompositeParams,
  SubtestThetaInput,
} from './foundational-composite.types';

// --- Pure scoring math (no I/O — exhaustively unit-tested) ---

/**
 * Compute the LPW (Letter–Phoneme–Word) composite as an inverse-variance (precision)
 * weighted average of the available subtest theta estimates.
 *
 * For each subtest `i` with a finite `thetaEstimate` and `thetaSE > 0`:
 *   weight_i = 1 / (thetaSE_i^2)
 *   LPW      = Σ(thetaEstimate_i * weight_i) / Σ(weight_i)
 *
 * Subtests with a missing/non-finite estimate or a non-positive SE are skipped (a
 * non-positive SE would divide by zero / contribute infinite precision).
 *
 * @param pairs - Available Letter/Phoneme/Word theta pairs (0–3 entries)
 * @returns The LPW composite, or `null` when no subtest can be weighted
 */
export function computeLpwComposite(pairs: SubtestThetaInput[]): number | null {
  let numerator = 0;
  let sumOfWeights = 0;

  for (const { thetaEstimate, thetaSE } of pairs) {
    if (!Number.isFinite(thetaEstimate) || !Number.isFinite(thetaSE) || thetaSE <= 0) {
      continue;
    }
    const weight = 1 / (thetaSE * thetaSE);
    numerator += thetaEstimate * weight;
    sumOfWeights += weight;
  }

  if (sumOfWeights === 0) {
    return null;
  }
  return numerator / sumOfWeights;
}

/**
 * Compute the final foundational composite from assembled inputs.
 *
 * - LPW available + Sentence available + `sreTransformed >= SRE_TRANSFORMED_FLOOR`:
 *   `final = 0.514 * LPW + 0.486 * sreTransformed`.
 * - LPW available otherwise (Sentence absent, or below the floor): `final = LPW`.
 * - Only Sentence available: `final = sreTransformed` (the floor does not gate this case).
 * - Nothing available: `null` (caller writes nothing).
 *
 * @param inputs - The assembled LPW pairs and optional Sentence transformed score
 * @returns The final composite value, or `null` when there is nothing to compute
 */
export function computeFoundationalComposite(inputs: FoundationalCompositeInputs): number | null {
  const lpw = computeLpwComposite(inputs.lpw);
  const sre = inputs.sreTransformed !== null && Number.isFinite(inputs.sreTransformed) ? inputs.sreTransformed : null;

  if (lpw !== null && sre !== null && sre >= SRE_TRANSFORMED_FLOOR) {
    return LPW_COMPOSITE_WEIGHT * lpw + SRE_TRANSFORMED_WEIGHT * sre;
  }
  if (lpw !== null) {
    return lpw;
  }
  if (sre !== null) {
    return sre;
  }
  return null;
}

// --- Internal helpers ---

/**
 * Parse a `run_scores.value` (stored as text) into a finite number, or `null`.
 */
function parseScoreValue(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Decimal places used when persisting the composite value. Generous relative to what norming
 * needs (lookup tables round theta to ~1 decimal), but enough to strip binary-float residue
 * so the stored text stays stable and human-legible.
 */
const COMPOSITE_VALUE_DECIMALS = 6;

/**
 * Format a computed composite for storage: round to a fixed precision and drop trailing
 * zeros (e.g. `1.7196000000000002` -> `"1.7196"`, `1.5` -> `"1.5"`).
 */
function formatCompositeValue(value: number): string {
  return String(Number(value.toFixed(COMPOSITE_VALUE_DECIMALS)));
}

/**
 * Group the flat score rows (one reporting run per taskId) into the composite inputs,
 * routing each subtest by its slug: LPW subtests contribute their `composite_foundational`
 * theta pair; Sentence contributes its `composite_foundational` `thetaEstimate` (its SE is
 * ignored — Sentence feeds the Stage-2 blend, not the inverse-variance LPW).
 */
function assembleInputs(
  rows: CompositeInputScoreRow[],
  taskIdToSlug: Map<string, FoundationalCompositeSlug>,
): FoundationalCompositeInputs {
  // taskId -> ("domain|name" -> value). Each taskId already resolves to a single
  // reporting run, so the theta pair is guaranteed to come from the same run.
  const scoresByTask = new Map<string, Map<string, string>>();
  for (const row of rows) {
    let scores = scoresByTask.get(row.taskId);
    if (!scores) {
      scores = new Map<string, string>();
      scoresByTask.set(row.taskId, scores);
    }
    scores.set(`${row.domain}|${row.name}`, row.value);
  }

  const lpw: SubtestThetaInput[] = [];
  let sreTransformed: number | null = null;

  for (const [taskId, scores] of scoresByTask) {
    const slug = taskIdToSlug.get(taskId);
    if (!slug) {
      continue;
    }

    if (slug === FOUNDATIONAL_COMPOSITE_SLUG.SRE) {
      sreTransformed = parseScoreValue(scores.get(`${SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL}|${SCORE_NAME.THETA_ESTIMATE}`));
      continue;
    }

    const thetaEstimate = parseScoreValue(
      scores.get(`${SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL}|${SCORE_NAME.THETA_ESTIMATE}`),
    );
    const thetaSE = parseScoreValue(scores.get(`${SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL}|${SCORE_NAME.THETA_SE}`));
    if (thetaEstimate !== null && thetaSE !== null) {
      lpw.push({ thetaEstimate, thetaSE });
    }
  }

  return { lpw, sreTransformed };
}

/**
 * FoundationalCompositeService
 *
 * Computes and persists a student's foundational composite for a `(userId,
 * administrationId)`. The composite is an inverse-variance weighted LPW composite
 * (Letter/Phoneme/Word) optionally blended with the Sentence/SRE transformed score, and
 * is stored on a dedicated composite run (see `constants/run.ts`).
 *
 * Intended to be invoked as the final step of `RunEventService.writeTrial`'s transaction,
 * after `recomputeBestRunForVariant`, so it reads the freshly-written scores and the
 * up-to-date `use_for_reporting` flags within the same transaction.
 *
 * @param runRepository - Assessment-DB run repository (injected for testing)
 * @param runScoresRepository - Assessment-DB run-scores repository (injected for testing)
 * @param taskRepository - Core-DB task repository for slug → taskId resolution (injected for testing)
 * @returns Object with the `recomputeForRun` method
 */
export function FoundationalCompositeService({
  runRepository = new RunRepository(),
  runScoresRepository = new RunScoresRepository(),
  taskRepository = new TaskRepository(),
}: {
  runRepository?: RunRepository;
  runScoresRepository?: RunScoresRepository;
  taskRepository?: TaskRepository;
} = {}) {
  // Closure-scoped memo of resolved foundational slug -> taskId. Task slugs are immutable,
  // so a resolved id is cached for the lifetime of the service instance. Unresolved slugs
  // (task not yet seeded) are intentionally not cached so they are retried on later calls.
  const taskIdCache = new Map<string, string>();

  /**
   * Resolve the `{ slug -> taskId }` map for the foundational subtests, memoizing
   * successful lookups. Slugs without a matching task are omitted. The (cold-start) lookups
   * run in parallel; warm calls are all cache hits.
   */
  async function resolveFoundationalTaskIds(): Promise<Map<FoundationalCompositeSlug, string>> {
    const entries = await Promise.all(
      FOUNDATIONAL_COMPOSITE_SLUGS.map(async (slug) => {
        const cached = taskIdCache.get(slug);
        if (cached) {
          return [slug, cached] as const;
        }
        const task = await taskRepository.getBySlug(slug);
        if (task) {
          taskIdCache.set(slug, task.id);
          return [slug, task.id] as const;
        }
        return null;
      }),
    );

    const resolved = new Map<FoundationalCompositeSlug, string>();
    for (const entry of entries) {
      if (entry) {
        resolved.set(entry[0], entry[1]);
      }
    }
    return resolved;
  }

  /**
   * Recompute and persist the foundational composite for the run's student/administration.
   *
   * No-op when: the administration is the anonymous sentinel, the triggering run's task is
   * not a foundational subtest, or no usable inputs exist (in which case any prior
   * composite value is left untouched). Idempotent — identical inputs upsert the same row.
   *
   * @param params - userId, administrationId, the triggering run's taskId, and the writeTrial tx
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database work fails
   */
  async function recomputeForRun(params: RecomputeFoundationalCompositeParams): Promise<void> {
    const { userId, administrationId, triggeringTaskId, transaction } = params;

    // Anonymous runs have no real administration context to aggregate over.
    if (administrationId === ANONYMOUS_RUN_ADMINISTRATION_ID) {
      return;
    }

    // Resolve the foundational slug -> taskId map (memoized). Needed both to classify the
    // triggering task and to gather the right runs; it intentionally runs before the
    // early-return because the run carries a taskId, not a slug, so the trigger can only be
    // classified via this map. For non-foundational tasks this is one cheap, memoized pass.
    const slugToTaskId = await resolveFoundationalTaskIds();
    const taskIds = [...slugToTaskId.values()];

    // Gate: only recompute when the triggering run is one of the foundational subtests.
    if (!taskIds.includes(triggeringTaskId)) {
      return;
    }

    const taskIdToSlug = new Map<string, FoundationalCompositeSlug>();
    for (const [slug, id] of slugToTaskId) {
      taskIdToSlug.set(id, slug);
    }

    try {
      // Serialize the entire gather → compute → write per (user, administration) BEFORE
      // reading the subtests' reporting runs. This guarantees the composite is computed
      // from a consistent, fully-recomputed use_for_reporting snapshot (the triggering
      // variant was just recomputed by RunService.recomputeBestRunForVariant) and that
      // concurrent writes for the same student cannot race or lose updates.
      await runRepository.lockCompositeForUpdate({
        userId,
        administrationId,
        transaction,
      });

      const { rows, reportingTaskIds } = await runRepository.getReportingRunScoresForComposite({
        userId,
        administrationId,
        taskIds,
        transaction,
      });

      const inputs = assembleInputs(rows, taskIdToSlug);

      // Guardrail: if the student has a Sentence (SRE) reporting run but it produced no
      // transformed score, the composite silently degrades to LPW-only. That usually means
      // the SRE score's name/domain drifted from what the assessment writes — surface it
      // loudly rather than producing a wrong-but-healthy-looking score. (See the SRE source
      // note in constants/foundational-composite.ts.)
      const sreTaskId = slugToTaskId.get(FOUNDATIONAL_COMPOSITE_SLUG.SRE);
      if (inputs.sreTransformed === null && sreTaskId !== undefined && reportingTaskIds.includes(sreTaskId)) {
        logger.warn(
          {
            context: {
              userId,
              administrationId,
              sreTaskId,
              expectedDomain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
              expectedName: SCORE_NAME.THETA_ESTIMATE,
            },
          },
          'Sentence (SRE) reporting run found but no transformed score; composite computed without Sentence',
        );
      }

      const composite = computeFoundationalComposite(inputs);

      // No usable inputs — leave any previously-written composite untouched.
      if (composite === null) {
        return;
      }

      const compositeRun = await runRepository.findOrCreateCompositeRun({
        userId,
        administrationId,
        transaction,
      });

      const scoreRow: NewRunScore = {
        runId: compositeRun.id,
        type: SCORE_TYPE.COMPUTED,
        domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
        name: SCORE_NAME.THETA_ESTIMATE,
        value: formatCompositeValue(composite),
        assessmentStage: null,
        categoryScore: null,
      };

      await runScoresRepository.upsertMany({
        data: [scoreRow],
        transaction,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error(
        { err: error, context: { userId, administrationId, triggeringTaskId } },
        'Failed to recompute foundational composite',
      );

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId, triggeringTaskId },
        cause: error,
      });
    }
  }

  return { recomputeForRun };
}
