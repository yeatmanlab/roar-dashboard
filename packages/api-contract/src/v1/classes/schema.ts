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
 * Request body for updating a class (PATCH /classes/:classId).
 *
 * A partial of the mutable subset of CreateClassRequestSchema, EXCLUDING
 * `schoolId` — every field is optional and only those present in the body are
 * applied. `.strict()` rejects unknown keys and immutable identity/hierarchy
 * fields (`id`, `schoolId`, `districtId`, `orgPath`): a class cannot be moved
 * to a different school/district after creation (`orgPath` and `districtId` are
 * derived from the parent school and enforced by DB triggers).
 *
 * `schoolLevels` is a generated column computed from `grades`, so it is never
 * accepted in the body — updating `grades` recomputes it server-side.
 */
export const UpdateClassRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    classType: ClassTypeSchema.optional(),
    subjects: z.array(z.string()).optional(),
    grades: z.array(UserGradeSchema).optional(),
    location: z.string().optional(),
  })
  .strict();

export type UpdateClassRequest = z.infer<typeof UpdateClassRequestSchema>;

/**
 * Response payload for PATCH /classes/:classId.
 *
 * Returns only the updated class id, matching the create-response shape.
 */
export const UpdateClassResponseSchema = z.object({
  id: z.string().uuid(),
});

export type UpdateClassResponse = z.infer<typeof UpdateClassResponseSchema>;

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
