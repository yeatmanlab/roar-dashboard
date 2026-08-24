import { describe, it, expect } from 'vitest';
import { FilterOperatorSchema } from '@roar-platform/api-contract';
import { FilterOperator } from './filter';

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
