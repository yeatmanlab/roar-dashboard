import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { isAncestorOrEqual } from './is-ancestor-or-equal.utils';

const testTable = pgTable('test', {
  childPath: text('child_path'),
  parentPath: text('parent_path'),
});

describe('is-ancestor-or-equal.utils', () => {
  describe('isAncestorOrEqual', () => {
    it('should generate SQL with @> operator', () => {
      const result = isAncestorOrEqual(testTable.parentPath, testTable.childPath);
      const expected = sql`${testTable.parentPath} @> ${testTable.childPath}`;

      expect(result.queryChunks).toEqual(expected.queryChunks);
    });
  });
});
