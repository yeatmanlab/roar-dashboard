import { z } from 'zod';
import { ClassTypeSchema, UserGradeSchema } from '../common/user';

/**
 * Request body for creating a class.
 *
 * Server-managed fields:
 * - `schoolId` is supplied by the caller; the service uses it to derive
 *   `districtId` (from the parent school's `parentOrgId`) and `orgPath`
 *   (copied by a database trigger from the parent school's `path`).
 * - `schoolLevels` is computed by a `generatedAlwaysAs` SQL clause on the
 *   column from the supplied `grades`; the client never sets it.
 * - `districtId` and `orgPath` are NOT accepted in the body.
 */
export const CreateClassRequestSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1),
  classType: ClassTypeSchema,
  number: z.string().optional(),
  period: z.string().optional(),
  termId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  subjects: z.array(z.string()).optional(),
  grades: z.array(UserGradeSchema).optional(),
  location: z.string().optional(),
});

export type CreateClassRequest = z.infer<typeof CreateClassRequestSchema>;

/**
 * Response payload for POST /classes.
 *
 * Returns only the new class id, matching the existing POST /runs and
 * POST /districts / POST /schools convention. Clients that need the full
 * entity follow up with a class detail endpoint when one exists.
 */
export const CreateClassResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateClassResponse = z.infer<typeof CreateClassResponseSchema>;
