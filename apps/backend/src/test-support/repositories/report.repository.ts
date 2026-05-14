import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { ReportRepository } from '../../repositories/report.repository';

/**
 * Creates a mock ReportRepository for unit tests.
 *
 * Note: ReportRepository is a standalone class (not BaseRepository), so this mock
 * must be updated manually when new public methods are added to the repository.
 */
export function createMockReportRepository(): MockedObject<ReportRepository> {
  return {
    getTaskMetadata: vi.fn(),
    isScopeAssignedToAdministration: vi.fn(),
    getUserRolesAtOrAboveScope: vi.fn(),
    getProgressStudents: vi.fn(),
    getProgressOverviewCounts: vi.fn(),
    getProgressOverviewCountsBulk: vi.fn(),
    getAllStudentsInScope: vi.fn(),
    getCompletedRunScores: vi.fn(),
    getSchoolNamesForUsers: vi.fn(),
    getStudentScores: vi.fn(),
    verifyStudentInScope: vi.fn(),
    // Default to 0 — most unit tests don't care about exclusion counts and
    // would otherwise need to mock this on every call. Tests asserting on
    // exclusion counts should override per-test with mockResolvedValue.
    countRosteringEndedExclusions: vi.fn().mockResolvedValue(0),
    getHistoricalRunsForUser: vi.fn(),
    getScoresForRunIds: vi.fn(),
    getCompletedRunsForUser: vi.fn(),
    verifyGuardianStudentLink: vi.fn(),
    verifyUserOrgOverlap: vi.fn(),
    getStudentAdministrations: vi.fn(),
  } as unknown as MockedObject<ReportRepository>;
}

export type MockReportRepository = ReturnType<typeof createMockReportRepository>;
