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
    getAllStudentsInScope: vi.fn(),
    getCompletedRunScores: vi.fn(),
    getSchoolNamesForUsers: vi.fn(),
    getStudentScores: vi.fn(),
    verifyStudentInScope: vi.fn(),
    getHistoricalRunsForUser: vi.fn(),
    getScoresForRunIds: vi.fn(),
    getCompletedRunsForUser: vi.fn(),
    verifyGuardianStudentLink: vi.fn(),
    verifyUserOrgOverlap: vi.fn(),
    getStudentAdministrations: vi.fn(),
    getTaskSubscoreStudents: vi.fn(),
  } as unknown as MockedObject<ReportRepository>;
}

export type MockReportRepository = ReturnType<typeof createMockReportRepository>;
