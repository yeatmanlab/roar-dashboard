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
export const CreateClassRequestSchema = z
  .object({
    schoolId: z.string().uuid(),
    name: z.string().min(1).max(255),
    classType: ClassTypeSchema,
    number: z.string().optional(),
    period: z.string().optional(),
    termId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    subjects: z.array(z.string()).optional(),
    grades: z.array(UserGradeSchema).optional(),
    location: z.string().optional(),
  })
  .strict();

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

/**
 * Class detail schema (read shape).
 *
 * Classes sit at the bottom of the org hierarchy (district > school > class).
 * The fields here do not all map 1:1 to columns:
 * - `id`, `name`, `schoolId`, `districtId`, and `classType` map directly to
 *   their `classes` columns.
 * - `schoolId`/`districtId` are surfaced (unlike groups/families, which are
 *   flat) because a class's place in the hierarchy is what makes it readable —
 *   admins of the ancestor school or district inherit `can_read`.
 * - `courseId` is an optional FK that is omitted from the response when null.
 * - `number`, `period`, `location`, and `rosteringEnded` are nullable columns
 *   that become optional fields, omitted when null. `location` is a single free
 *   text column on `classes` (a room/location label) — not an assembled address
 *   object like the one on groups/families, and there is no coordinate point.
 * - `subjects`, `grades`, and the generated `schoolLevels` array are optional
 *   array columns, included only when populated.
 * - `orgPath`, `termId`, and the `timestamps`/`createdBy` columns are
 *   intentionally not surfaced.
 */
export const ClassDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  schoolId: z.string().uuid(),
  districtId: z.string().uuid(),
  classType: ClassTypeSchema,
  courseId: z.string().uuid().optional(),
  number: z.string().optional(),
  period: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  grades: z.array(UserGradeSchema).optional(),
  schoolLevels: z.array(z.string()).optional(),
  location: z.string().optional(),
  rosteringEnded: z.string().datetime().optional(),
});

export type ClassDetail = z.infer<typeof ClassDetailSchema>;
