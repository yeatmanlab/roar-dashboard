/**
 * Represents comparison operators used in filtering operations.
 *
 * - `equals`: Checks if field equals the specified value
 * - `notEquals`: Checks if field does not equal the specified value
 * - `lessThan`: Checks if field is less than the specified value
 * - `lessThanOrEqual`: Checks if field is less than or equal to the specified value
 * - `greaterThan`: Checks if field is greater than the specified value
 * - `greaterThanOrEqual`: Checks if field is greater than or equal to the specified value
 * - `contains`: Checks if field contains the specified value (for strings or arrays)
 * - `in`: Checks if field value is in the specified array
 * - `notIn`: Checks if field value is not in the specified array
 * - `containsAny`: Checks if field contains any of the specified values
 * - `isNull`: Checks if field is null
 * - `isNotNull`: Checks if field is not null
 */
export type ComparisonOperator =
  | 'equals'
  | 'notEquals'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'contains'
  | 'in'
  | 'notIn'
  | 'containsAny'
  | 'isNull'
  | 'isNotNull';

/**
 * Represents a filter that compares a field to a specific value using a comparison operator.
 */
export interface SingleFilter {
  /** The field name or path to filter on (can be a string or array of strings for nested fields) */
  field: string | string[];
  /** The comparison operator to use for the filter condition */
  op: ComparisonOperator;
  /** The value to compare the field against */
  value: unknown;
}

/**
 * Represents a composite filter that combines multiple filters using a logical operator.
 */
export interface CompositeFilter {
  /** An array of filters (either SingleFilter or CompositeFilter) to be combined */
  filters: BaseFilter[];
  /**
   * The logical operator to use when combining filters:
   * - 'and': All filter conditions must be true
   * - 'or': At least one filter condition must be true
   */
  op: 'and' | 'or';
}

/**
 * Represents the base type for all filters used in filtering operations.
 *
 * This type is a union of SingleFilter and CompositeFilter, allowing for
 * both simple field comparisons and complex nested filter logic.
 * It serves as the foundation for building filter structures of any complexity.
 */
export type BaseFilter = SingleFilter | CompositeFilter;

/**
 * Interface that defines a function to create filters from a BaseFilter object.
 *
 * This adapter pattern interface provides a way to transform BaseFilter objects
 * into domain-specific filter representations of type T. Implementations of this
 * interface should define how to convert both SingleFilter and CompositeFilter
 * structures into the target filter format.
 * @typeParam T - The target filter type that BaseFilter objects will be converted to.
 */
export interface FilterAdapter<T> {
  /** The function to adapt a BaseFilter object into the target filter format. */
  adapt(filter: BaseFilter): T;
}
