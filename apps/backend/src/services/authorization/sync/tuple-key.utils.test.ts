import { describe, it, expect } from 'vitest';
import type { TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { serializeTupleKey, categorizeFgaTuples, diffTuples } from './tuple-key.utils';

describe('tuple-key.utils', () => {
  describe('serializeTupleKey', () => {
    it('serializes a tuple without condition', () => {
      const tuple: TupleKeyWithoutCondition = {
        user: 'district:d1',
        relation: 'parent_org',
        object: 'school:s1',
      };

      expect(serializeTupleKey(tuple)).toBe('district:d1|parent_org|school:s1');
    });

    it('serializes a tuple with condition and context', () => {
      const tuple: TupleKey = {
        user: 'user:u1',
        relation: 'student',
        object: 'class:c1',
        condition: {
          name: 'active_membership',
          context: {
            grant_start: '2024-01-01T00:00:00.000Z',
            grant_end: '9999-12-31T23:59:59Z',
          },
        },
      };

      expect(serializeTupleKey(tuple)).toBe(
        'user:u1|student|class:c1|active_membership|grant_end=9999-12-31T23:59:59Z,grant_start=2024-01-01T00:00:00.000Z',
      );
    });

    it('sorts context keys alphabetically for deterministic output', () => {
      const tupleA: TupleKey = {
        user: 'user:u1',
        relation: 'teacher',
        object: 'school:s1',
        condition: {
          name: 'active_membership',
          context: { zebra: '1', alpha: '2' },
        },
      };

      const tupleB: TupleKey = {
        user: 'user:u1',
        relation: 'teacher',
        object: 'school:s1',
        condition: {
          name: 'active_membership',
          context: { alpha: '2', zebra: '1' },
        },
      };

      expect(serializeTupleKey(tupleA)).toBe(serializeTupleKey(tupleB));
    });

    it('serializes a tuple with condition but no context', () => {
      const tuple: TupleKey = {
        user: 'user:u1',
        relation: 'student',
        object: 'class:c1',
        condition: { name: 'some_condition' },
      };

      expect(serializeTupleKey(tuple)).toBe('user:u1|student|class:c1|some_condition');
    });

    it('serializes a tuple with condition and empty context', () => {
      const tuple: TupleKey = {
        user: 'user:u1',
        relation: 'student',
        object: 'class:c1',
        condition: { name: 'some_condition', context: {} },
      };

      expect(serializeTupleKey(tuple)).toBe('user:u1|student|class:c1|some_condition');
    });
  });

  describe('categorizeFgaTuples', () => {
    it('categorizes district hierarchy tuples as orgHierarchy', () => {
      const tuples: TupleKey[] = [
        { user: 'district:d1', relation: 'parent_org', object: 'school:s1' },
        { user: 'school:s1', relation: 'child_school', object: 'district:d1' },
      ];

      const result = categorizeFgaTuples(tuples);

      expect(result.orgHierarchy).toHaveLength(2);
      expect(result.orgMemberships).toHaveLength(0);
    });

    it('categorizes school hierarchy tuples as orgHierarchy', () => {
      const tuples: TupleKey[] = [
        { user: 'school:s1', relation: 'parent_org', object: 'class:c1' },
        { user: 'class:c1', relation: 'child_class', object: 'school:s1' },
      ];

      const result = categorizeFgaTuples(tuples);

      expect(result.orgHierarchy).toHaveLength(2);
      expect(result.classMemberships).toHaveLength(0);
    });

    it('categorizes district membership tuples as orgMemberships', () => {
      const tuples: TupleKey[] = [
        {
          user: 'user:u1',
          relation: 'administrator',
          object: 'district:d1',
          condition: { name: 'active_membership', context: { grant_start: '2024-01-01', grant_end: '9999-12-31' } },
        },
      ];

      const result = categorizeFgaTuples(tuples);

      expect(result.orgMemberships).toHaveLength(1);
      expect(result.orgHierarchy).toHaveLength(0);
    });

    it('categorizes school membership tuples as orgMemberships', () => {
      const tuples: TupleKey[] = [
        {
          user: 'user:u1',
          relation: 'teacher',
          object: 'school:s1',
          condition: { name: 'active_membership', context: {} },
        },
      ];

      const result = categorizeFgaTuples(tuples);

      expect(result.orgMemberships).toHaveLength(1);
    });

    it('categorizes class membership tuples as classMemberships', () => {
      const tuples: TupleKey[] = [
        {
          user: 'user:u1',
          relation: 'student',
          object: 'class:c1',
          condition: { name: 'active_membership', context: {} },
        },
      ];

      const result = categorizeFgaTuples(tuples);

      expect(result.classMemberships).toHaveLength(1);
      expect(result.orgHierarchy).toHaveLength(0);
    });

    it('categorizes group tuples as groupMemberships', () => {
      const tuples: TupleKey[] = [{ user: 'user:u1', relation: 'student', object: 'group:g1' }];

      const result = categorizeFgaTuples(tuples);

      expect(result.groupMemberships).toHaveLength(1);
    });

    it('categorizes family tuples as familyMemberships', () => {
      const tuples: TupleKey[] = [{ user: 'user:u1', relation: 'parent', object: 'family:f1' }];

      const result = categorizeFgaTuples(tuples);

      expect(result.familyMemberships).toHaveLength(1);
    });

    it('categorizes administration tuples as administrationAssignments', () => {
      const tuples: TupleKey[] = [
        { user: 'district:d1', relation: 'assigned_district', object: 'administration:a1' },
        { user: 'school:s1', relation: 'assigned_school', object: 'administration:a2' },
        { user: 'class:c1', relation: 'assigned_class', object: 'administration:a3' },
        { user: 'group:g1', relation: 'assigned_group', object: 'administration:a4' },
      ];

      const result = categorizeFgaTuples(tuples);

      expect(result.administrationAssignments).toHaveLength(4);
    });

    it('handles mixed tuples across all categories', () => {
      const tuples: TupleKey[] = [
        { user: 'district:d1', relation: 'parent_org', object: 'school:s1' },
        { user: 'user:u1', relation: 'administrator', object: 'district:d1' },
        { user: 'user:u2', relation: 'student', object: 'class:c1' },
        { user: 'user:u3', relation: 'student', object: 'group:g1' },
        { user: 'user:u4', relation: 'parent', object: 'family:f1' },
        { user: 'district:d1', relation: 'assigned_district', object: 'administration:a1' },
      ];

      const result = categorizeFgaTuples(tuples);

      expect(result.orgHierarchy).toHaveLength(1);
      expect(result.orgMemberships).toHaveLength(1);
      expect(result.classMemberships).toHaveLength(1);
      expect(result.groupMemberships).toHaveLength(1);
      expect(result.familyMemberships).toHaveLength(1);
      expect(result.administrationAssignments).toHaveLength(1);
    });

    it('returns empty arrays for empty input', () => {
      const result = categorizeFgaTuples([]);

      expect(result.orgHierarchy).toHaveLength(0);
      expect(result.orgMemberships).toHaveLength(0);
      expect(result.classMemberships).toHaveLength(0);
      expect(result.groupMemberships).toHaveLength(0);
      expect(result.familyMemberships).toHaveLength(0);
      expect(result.administrationAssignments).toHaveLength(0);
    });
  });

  describe('diffTuples', () => {
    it('returns all desired tuples as writes when FGA is empty', () => {
      const desired: TupleKeyWithoutCondition[] = [
        { user: 'district:d1', relation: 'parent_org', object: 'school:s1' },
        { user: 'school:s1', relation: 'child_school', object: 'district:d1' },
      ];

      const result = diffTuples(desired, []);

      expect(result.toWrite).toHaveLength(2);
      expect(result.toDelete).toHaveLength(0);
    });

    it('returns all existing tuples as deletes when Postgres is empty', () => {
      const existing: TupleKey[] = [
        { user: 'district:d1', relation: 'parent_org', object: 'school:s1' },
        { user: 'school:s1', relation: 'child_school', object: 'district:d1' },
      ];

      const result = diffTuples([], existing);

      expect(result.toWrite).toHaveLength(0);
      expect(result.toDelete).toHaveLength(2);
    });

    it('returns no writes or deletes when tuples match exactly', () => {
      const tuples: TupleKey[] = [
        { user: 'district:d1', relation: 'parent_org', object: 'school:s1' },
        {
          user: 'user:u1',
          relation: 'student',
          object: 'class:c1',
          condition: {
            name: 'active_membership',
            context: { grant_start: '2024-01-01T00:00:00.000Z', grant_end: '9999-12-31T23:59:59Z' },
          },
        },
      ];

      const result = diffTuples(tuples, tuples);

      expect(result.toWrite).toHaveLength(0);
      expect(result.toDelete).toHaveLength(0);
    });

    it('handles condition change as 1 delete + 1 write', () => {
      const oldTuple: TupleKey = {
        user: 'user:u1',
        relation: 'student',
        object: 'class:c1',
        condition: {
          name: 'active_membership',
          context: { grant_start: '2024-01-01T00:00:00.000Z', grant_end: '2024-06-01T00:00:00.000Z' },
        },
      };

      const newTuple: TupleKey = {
        user: 'user:u1',
        relation: 'student',
        object: 'class:c1',
        condition: {
          name: 'active_membership',
          context: { grant_start: '2024-01-01T00:00:00.000Z', grant_end: '2025-06-01T00:00:00.000Z' },
        },
      };

      const result = diffTuples([newTuple], [oldTuple]);

      expect(result.toWrite).toHaveLength(1);
      expect(result.toDelete).toHaveLength(1);
      expect(result.toWrite[0]).toBe(newTuple);
      expect(result.toDelete[0]).toBe(oldTuple);
    });

    it('handles mixed scenario: new, stale, and unchanged tuples', () => {
      const unchanged: TupleKey = { user: 'district:d1', relation: 'parent_org', object: 'school:s1' };
      const stale: TupleKey = { user: 'user:old', relation: 'student', object: 'class:c1' };
      const newTuple: TupleKeyWithoutCondition = { user: 'district:d1', relation: 'parent_org', object: 'school:s2' };

      const desired = [unchanged, newTuple];
      const existing = [unchanged, stale];

      const result = diffTuples(desired, existing);

      expect(result.toWrite).toHaveLength(1);
      expect(result.toWrite[0]).toBe(newTuple);
      expect(result.toDelete).toHaveLength(1);
      expect(result.toDelete[0]).toBe(stale);
    });
  });
});
