import { describe, it, expect } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { ConditionFieldMap } from './condition-to-sql';
import { conditionToSql } from './condition-to-sql';
import { Operator } from '../types/condition';
import type { FieldCondition, CompositeCondition } from '../types/condition';
import { users } from '../db/schema';

const dialect = new PgDialect();
function toSql(condition: ReturnType<typeof conditionToSql>): string | undefined {
  if (!condition) return undefined;
  return dialect.sqlToQuery(condition).sql;
}

const FIELD_MAP: ConditionFieldMap = {
  'studentData.grade': users.grade,
  'studentData.statusEll': users.statusEll,
  'studentData.statusIep': users.statusIep,
  'studentData.gender': users.gender,
  'studentData.hispanicEthnicity': users.hispanicEthnicity,
};

describe('conditionToSql', () => {
  describe('null and SelectAllCondition', () => {
    it('returns undefined for null condition', () => {
      expect(conditionToSql(null, FIELD_MAP)).toBeUndefined();
    });

    it('returns undefined for SelectAllCondition (true)', () => {
      expect(conditionToSql(true, FIELD_MAP)).toBeUndefined();
    });
  });

  describe('FieldCondition operators', () => {
    it('translates EQUAL to =', () => {
      const condition: FieldCondition = { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('= $1');
    });

    it('translates NOT_EQUAL to <>', () => {
      const condition: FieldCondition = { field: 'studentData.statusEll', op: Operator.NOT_EQUAL, value: 'active' };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('<> $1');
    });

    it('translates LESS_THAN to <', () => {
      const condition: FieldCondition = { field: 'studentData.statusEll', op: Operator.LESS_THAN, value: 'z' };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('< $1');
    });

    it('translates GREATER_THAN to >', () => {
      const condition: FieldCondition = { field: 'studentData.statusEll', op: Operator.GREATER_THAN, value: 'a' };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('> $1');
    });

    it('translates LESS_THAN_OR_EQUAL to <=', () => {
      const condition: FieldCondition = { field: 'studentData.statusEll', op: Operator.LESS_THAN_OR_EQUAL, value: 'z' };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('<= $1');
    });

    it('translates GREATER_THAN_OR_EQUAL to >=', () => {
      const condition: FieldCondition = {
        field: 'studentData.statusEll',
        op: Operator.GREATER_THAN_OR_EQUAL,
        value: 'a',
      };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('>= $1');
    });
  });

  describe('grade-aware range operators', () => {
    it('converts GREATER_THAN_OR_EQUAL on grade to an IN clause', () => {
      const condition: FieldCondition = {
        field: 'studentData.grade',
        op: Operator.GREATER_THAN_OR_EQUAL,
        value: '10',
      };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('in (');
    });

    it('converts LESS_THAN_OR_EQUAL on grade to an IN clause', () => {
      const condition: FieldCondition = {
        field: 'studentData.grade',
        op: Operator.LESS_THAN_OR_EQUAL,
        value: '3',
      };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('in (');
    });

    it('uses standard EQUAL for grade equality', () => {
      const condition: FieldCondition = { field: 'studentData.grade', op: Operator.EQUAL, value: '3' };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('= $1');
      expect(sqlStr).not.toContain('in (');
    });
  });

  describe('CompositeCondition', () => {
    it('translates AND composite', () => {
      const condition: CompositeCondition = {
        op: 'AND',
        conditions: [
          { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          { field: 'studentData.grade', op: Operator.EQUAL, value: '3' },
        ],
      };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain(' and ');
    });

    it('translates OR composite', () => {
      const condition: CompositeCondition = {
        op: 'OR',
        conditions: [
          { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'true' },
        ],
      };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain(' or ');
    });

    it('handles nested composites', () => {
      const condition: CompositeCondition = {
        op: 'AND',
        conditions: [
          { field: 'studentData.grade', op: Operator.EQUAL, value: '5' },
          {
            op: 'OR',
            conditions: [
              { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
              { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'true' },
            ],
          },
        ],
      };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toBeDefined();
      expect(sqlStr).toContain(' and ');
      expect(sqlStr).toContain(' or ');
    });

    it('returns single child directly for single-element composite', () => {
      const condition: CompositeCondition = {
        op: 'AND',
        conditions: [{ field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' }],
      };
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('= $1');
      // Should not contain AND since there's only one child
      expect(sqlStr).not.toContain(' and ');
    });
  });

  describe('unknown fields', () => {
    it('returns undefined for unknown field paths', () => {
      const condition: FieldCondition = { field: 'unknown.field', op: Operator.EQUAL, value: 'test' };
      expect(conditionToSql(condition, FIELD_MAP)).toBeUndefined();
    });

    it('filters out unknown fields in composites', () => {
      const condition: CompositeCondition = {
        op: 'AND',
        conditions: [
          { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          { field: 'unknown.field', op: Operator.EQUAL, value: 'test' },
        ],
      };
      // The unknown field is skipped; only the known field's condition remains
      const sqlStr = toSql(conditionToSql(condition, FIELD_MAP));
      expect(sqlStr).toContain('= $1');
      expect(sqlStr).not.toContain(' and ');
    });
  });
});
