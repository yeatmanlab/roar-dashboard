import { describe, it, expect } from 'vitest';

/**
 * RunsController Tests
 *
 * Note: The RunsController instantiates RunService and RunEventsService at module load time,
 * making traditional mocking difficult. These tests verify the controller's
 * structure and that methods are properly exported.
 *
 * For comprehensive testing of the business logic, see:
 * - run.service.test.ts for create endpoint logic
 * - run-events.service.test.ts for event endpoint logic
 *
 * The controller handles HTTP concerns and delegates business logic to services:
 * - create: POST /runs - Creates a new run
 * - event: POST /runs/:runId/event - Handles run events (complete, abort, trial, engagement)
 */
describe('RunsController', () => {
  it('should export RunsController with create and event methods', async () => {
    const { RunsController } = await import('./runs.controller');

    expect(RunsController).toBeDefined();
    expect(RunsController.create).toBeDefined();
    expect(RunsController.event).toBeDefined();
    expect(typeof RunsController.create).toBe('function');
    expect(typeof RunsController.event).toBe('function');
  });
});
