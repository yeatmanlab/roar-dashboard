import { describe, it, expect } from 'vitest';
import type { FilterOperator as ContractFilterOperator } from '@roar-platform/api-contract';
import { FilterOperatorSchema } from '@roar-platform/api-contract';
import { FilterOperator } from './filter';

/**
 * Compile-time half of the coverage check below.
 *
 * `buildOperatorCondition` switches over the backend union and closes its `default` with
 * `satisfies never`, so the compiler already guarantees backend ⊆ implemented-in-SQL.
 * This assertion supplies the other hop — contract ⊆ backend — so the end-to-end property
 * (every operator the contract accepts is one the query builder honours) stays a build
 * failure rather than a test failure. It lives here rather than in `types/filter.ts`
 * because importing the contract there is exactly the coupling this module removed; test
 * files are exempt from that rule for this reason.
 */
type Assert<T extends true> = T;
export type ContractOperatorsAreSupported = Assert<ContractFilterOperator extends FilterOperator ? true : false>;

describe('FilterOperator', () => {
  describe('coverage of the api-contract operator set', () => {
    // Deliberately a subset assertion, not equality. The backend owns this vocabulary
    // because it implements it in SQL, so it may support operators the transport layer
    // doesn't expose yet. The direction that must hold is the other one: every operator
    // the contract accepts at the boundary has to be one the query builder can honour,
    // or a valid request produces a silently unfiltered query.
    it('supports every operator the contract exposes', () => {
      const supported = new Set<string>(Object.values(FilterOperator));

      for (const contractOperator of FilterOperatorSchema.options) {
        expect(supported).toContain(contractOperator);
      }
    });
  });
});
