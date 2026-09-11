import { z } from 'zod';

const DISTRICT = 'district';
const SCHOOL = 'school';
const CLASS = 'class';
const GROUP = 'group';
const FAMILY = 'family';

/** Enum for the types of entities that a user can be associated with. */
export const EntityTypeSchema = z.enum([DISTRICT, SCHOOL, CLASS, GROUP, FAMILY]);

export type EntityType = z.infer<typeof EntityTypeSchema>;
