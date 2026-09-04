/**
 * Backend-owned filter types.
 *
 * These mirror the api-contract's `?filter=field:operator:value` vocabulary, but the
 * backend owns them because it is the side that implements them: the operator set is
 * bounded by what `buildFilterConditions` can express in SQL, not by what the transport
 * layer can parse. A new operator is only real once the query builder handles it.
 */

/**
 * Comparison operators supported by `buildFilterConditions`.
 *
 * Keep in sync with `buildOperatorCondition` — adding a member here without a matching
 * branch there is caught by that function's exhaustiveness check.
 */
export const FilterOperator = {
  EQ: 'eq',
  NEQ: 'neq',
  IN: 'in',
  GTE: 'gte',
  LTE: 'lte',
  CONTAINS: 'contains',
} as const;

export type FilterOperator = (typeof FilterOperator)[keyof typeof FilterOperator];

/**
 * A single parsed filter expression.
 *
 * @typeParam TField - The allowed filter field names. Defaults to `string`; repositories
 *   that constrain sortable/filterable columns pass their own union.
 */
export interface ParsedFilter<TField extends string = string> {
  field: TField;
  operator: FilterOperator;
  value: string;
}
