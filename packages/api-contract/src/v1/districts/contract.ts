import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  DistrictsListQuerySchema,
  DistrictsListResponseSchema,
  DistrictGetQuerySchema,
  DistrictGetResponseSchema,
} from './schema';

const c = initContract();

/**
 * Districts API Contract
 *
 * Provides endpoints for managing district organizations.
 */
export const DistrictsContract = c.router({
  /**
   * List districts with optional filtering and embedding.
   *
   * GET /api/v1/districts
   */
  list: {
    method: 'GET',
    path: '/districts',
    query: DistrictsListQuerySchema,
    responses: {
      200: DistrictsListResponseSchema,
      401: z.object({ message: z.string() }),
      500: z.object({ message: z.string() }),
    },
    summary: 'List districts',
    description: 'Retrieve a paginated list of districts with optional filtering and embedding',
  },

  /**
   * Get a single district by ID with optional embedding.
   *
   * GET /api/v1/districts/:id
   */
  getById: {
    method: 'GET',
    path: '/districts/:id',
    pathParams: z.object({
      id: z.string().uuid(),
    }),
    query: DistrictGetQuerySchema,
    responses: {
      200: DistrictGetResponseSchema,
      400: z.object({ message: z.string() }),
      401: z.object({ message: z.string() }),
      403: z.object({ message: z.string() }),
      404: z.object({ message: z.string() }),
      500: z.object({ message: z.string() }),
    },
    summary: 'Get district by ID',
    description: 'Retrieve detailed information for a specific district by ID with optional child embedding',
  },
});
