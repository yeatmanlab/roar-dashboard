import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { isDescendantOrEqual } from './is-descendant-or-equal.utils';

const testTable = pgTable('test', {
  childPath: text('child_path'),
  parentPath: text('parent_path'),
});

describe('is-descendant-or-equal.utils', () => {
  describe('isDescendantOrEqual', () => {
    it('should generate SQL with <@ operator', () => {
      const result = isDescendantOrEqual(testTable.childPath, testTable.parentPath);
      const expected = sql`${testTable.childPath} <@ ${testTable.parentPath}`;

      expect(result.queryChunks).toEqual(expected.queryChunks);
    });
  });
});
