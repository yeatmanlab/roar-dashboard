import { z } from 'zod'

/**
 * Schema for a 404 Not Found response.
 */
export const NotFound = z.object({ message: z.string() });

/**
 * Schema for a 401 Unauthorized response.
 */
export const Unauthorized = z.object({ message: z.string() });