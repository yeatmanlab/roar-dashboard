import { z } from 'zod';
import {
  IndividualStudentReportTaskSchema,
  HistoricalScoreSchema,
} from '../../../administrations/reports/scores/schema';

/**
 * Per-task entry in the guardian/longitudinal student report.
 *
 * Identical in shape to the per-administration entry from the admin-scoped
 * individual student report, minus the per-task `historicalScores` array —
 * historical data on this endpoint lives at the top level under
 * `longitudinalScores`, keyed by task slug across all administrations.
 */
export const GuardianReportTaskEntrySchema = IndividualStudentReportTaskSchema.omit({
  historicalScores: true,
});

export type GuardianReportTaskEntry = z.infer<typeof GuardianReportTaskEntrySchema>;

/**
 * One administration entry in the guardian report. Each entry includes the
 * administration's identifying metadata plus its `tasks` array — the same
 * per-task shape as the admin-scoped report, minus `historicalScores`.
 */
export const GuardianReportAdministrationSchema = z.object({
  administrationId: z.string().uuid(),
  name: z.string(),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime(),
  tasks: z.array(GuardianReportTaskEntrySchema),
});

export type GuardianReportAdministration = z.infer<typeof GuardianReportAdministrationSchema>;

/**
 * Header-level student info for the guardian report.
 *
 * Adds `schoolName` on top of the admin-scoped header — the guardian view is
 * not anchored to a single org/class scope, so the school is surfaced from
 * the student's primary org membership for display.
 */
export const GuardianReportStudentSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  grade: z.string().nullable(),
  schoolName: z.string().nullable(),
});

export type GuardianReportStudent = z.infer<typeof GuardianReportStudentSchema>;

/**
 * Longitudinal scores keyed by task slug. Each entry is an array of one
 * `HistoricalScoreSchema` point per administration the student has
 * classifiable scores in for that task, sorted ascending by administration
 * `dateStart`. Tasks the student never completed are absent.
 *
 * Multi-variant tasks contribute one entry per administration — the
 * earliest-completed variant within an administration represents the task
 * (matching the per-task historical-score dedup used by the admin endpoint).
 */
export const LongitudinalScoresSchema = z.record(z.string(), z.array(HistoricalScoreSchema));

export type LongitudinalScores = z.infer<typeof LongitudinalScoresSchema>;

/**
 * Response schema for the guardian student report endpoint.
 *
 * Returns a single resource (no pagination): one student's complete history
 * across all administrations they have started, completed, or remain
 * assigned to.
 *
 * - `administrations` is sorted ascending by `dateStart`.
 * - `longitudinalScores[<taskSlug>]` is sorted ascending by administration
 *   `dateStart`. Both are independently sorted; the consumer should not
 *   assume index alignment between them.
 */
export const GuardianStudentReportResponseSchema = z.object({
  student: GuardianReportStudentSchema,
  administrations: z.array(GuardianReportAdministrationSchema),
  longitudinalScores: LongitudinalScoresSchema,
});

export type GuardianStudentReportResponse = z.infer<typeof GuardianStudentReportResponseSchema>;
