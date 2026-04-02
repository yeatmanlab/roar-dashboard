/**
 * Sort order constant for use in repository query builders.
 *
 * Defined here so repositories do not depend on the api-contract package.
 * The api-contract's SortOrder is derived from the same values.
 */
export const SortOrder = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
