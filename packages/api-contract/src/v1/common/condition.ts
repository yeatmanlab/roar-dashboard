import { z } from 'zod';

/**
 * Operators supported for field condition comparisons.
 */
export const OperatorSchema = z.enum([
  'LESS_THAN',
  'GREATER_THAN',
  'LESS_THAN_OR_EQUAL',
  'GREATER_THAN_OR_EQUAL',
  'EQUAL',
  'NOT_EQUAL',
]);

export type Operator = z.infer<typeof OperatorSchema>;

/**
 * A condition that compares a field value against a target value.
 * The `field` property uses dot notation (e.g., "studentData.grade").
 */
export const FieldConditionSchema = z.object({
  field: z.string(),
  op: OperatorSchema,
  value: z.union([z.boolean(), z.number(), z.string()]),
});

export type FieldCondition = z.infer<typeof FieldConditionSchema>;

/**
 * Base type for recursive condition definition.
 */
export type Condition = FieldCondition | CompositeCondition | true;

export interface CompositeCondition {
  op: 'AND' | 'OR';
  conditions: Condition[];
}

/**
 * Recursive Zod schema for Condition type.
 * Handles: FieldCondition, CompositeCondition, or SelectAllCondition (true literal).
 */
export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.literal(true), // SelectAllCondition
    FieldConditionSchema,
    z.object({
      op: z.enum(['AND', 'OR']),
      conditions: z.array(ConditionSchema),
    }),
  ]),
);
