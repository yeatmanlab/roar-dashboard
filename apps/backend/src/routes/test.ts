import type { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { baseFixture } from '../test-support/fixtures';

/**
 * Test-only routes for SDK integration tests.
 *
 * These routes are only available in test mode (NODE_ENV=test) and provide
 * access to the seeded baseFixture data for SDK integration tests.
 *
 * @param router - The Express router to register routes on
 */
export function registerTestRoutes(router: Router): void {
  // Only register test routes in test mode
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  /**
   * GET /test/fixture
   *
   * Returns the seeded baseFixture data for use in SDK integration tests.
   * This allows tests to dynamically fetch task variant IDs and other test data
   * instead of using hardcoded UUIDs.
   */
  router.get('/test/fixture', (_req: Request, res: Response) => {
    if (!baseFixture) {
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        error: {
          message: 'Base fixture not yet seeded. Ensure global setup has completed.',
        },
      });
    }

    return res.status(StatusCodes.OK).json({
      variantForAllGrades: { id: baseFixture.variantForAllGrades.id },
      variantForGrade5: { id: baseFixture.variantForGrade5.id },
      variantForGrade3: { id: baseFixture.variantForGrade3.id },
      variantOptionalForEll: { id: baseFixture.variantOptionalForEll.id },
      variantForTask2: { id: baseFixture.variantForTask2.id },
      variantForTask2Grade5OptionalEll: { id: baseFixture.variantForTask2Grade5OptionalEll.id },
    });
  });
}
