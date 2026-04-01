import type { TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { FgaType, FgaHierarchyRelation } from '../../authorization/fga-constants';

/**
 * Canonical string serialization of a tuple key for Set-based diffing.
 *
 * Format: `user|relation|object` for tuples without conditions,
 * `user|relation|object|condition_name|key1=val1,key2=val2` for tuples with conditions.
 * Context keys are sorted alphabetically for deterministic output.
 *
 * The `|` delimiter is safe because FGA user/object fields use `type:id` format
 * (neither component contains `|`) and condition context values in this codebase
 * are ISO timestamps. If new condition context shapes are introduced, verify that
 * their values cannot contain `|`.
 *
 * @param tuple - The tuple key to serialize
 * @returns A canonical string representation
 */
export function serializeTupleKey(tuple: TupleKey | TupleKeyWithoutCondition): string {
  const base = `${tuple.user}|${tuple.relation}|${tuple.object}`;

  const condition = 'condition' in tuple ? tuple.condition : undefined;
  if (!condition) return base;

  const contextEntries = Object.entries(condition.context ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const contextStr = contextEntries.map(([k, v]) => `${k}=${String(v)}`).join(',');

  return contextStr ? `${base}|${condition.name}|${contextStr}` : `${base}|${condition.name}`;
}

/** Set of FGA hierarchy relation values for fast lookup. */
const HIERARCHY_RELATIONS: ReadonlySet<string> = new Set<string>([
  FgaHierarchyRelation.PARENT_ORG,
  FgaHierarchyRelation.CHILD_SCHOOL,
  FgaHierarchyRelation.CHILD_CLASS,
]);

/** Object type prefixes that belong to the org hierarchy or org/class membership categories. */
const ORG_OBJECT_PREFIXES = [`${FgaType.DISTRICT}:`, `${FgaType.SCHOOL}:`] as const;

const CLASS_OBJECT_PREFIX = `${FgaType.CLASS}:`;
const GROUP_OBJECT_PREFIX = `${FgaType.GROUP}:`;
const FAMILY_OBJECT_PREFIX = `${FgaType.FAMILY}:`;
const ADMINISTRATION_OBJECT_PREFIX = `${FgaType.ADMINISTRATION}:`;

/** The six sync categories. */
export type SyncCategory =
  | 'orgHierarchy'
  | 'orgMemberships'
  | 'classMemberships'
  | 'groupMemberships'
  | 'familyMemberships'
  | 'administrationAssignments';

/**
 * Partition FGA tuples read from the store into the 6 sync categories.
 *
 * Categorization rules:
 * - district:/school:/class: objects with hierarchy relations → orgHierarchy
 * - district:/school: objects with non-hierarchy relations → orgMemberships
 * - class: objects with non-hierarchy relations → classMemberships
 * - group: objects → groupMemberships
 * - family: objects → familyMemberships
 * - administration: objects → administrationAssignments
 *
 * @param tuples - Flat array of FGA tuples (from paginated reads)
 * @returns Record mapping each category to its tuples
 */
export function categorizeFgaTuples(tuples: TupleKey[]): Record<SyncCategory, TupleKey[]> {
  const result: Record<SyncCategory, TupleKey[]> = {
    orgHierarchy: [],
    orgMemberships: [],
    classMemberships: [],
    groupMemberships: [],
    familyMemberships: [],
    administrationAssignments: [],
  };

  for (const tuple of tuples) {
    const obj = tuple.object;
    const isHierarchy = HIERARCHY_RELATIONS.has(tuple.relation);

    if (obj.startsWith(GROUP_OBJECT_PREFIX)) {
      result.groupMemberships.push(tuple);
    } else if (obj.startsWith(FAMILY_OBJECT_PREFIX)) {
      result.familyMemberships.push(tuple);
    } else if (obj.startsWith(ADMINISTRATION_OBJECT_PREFIX)) {
      result.administrationAssignments.push(tuple);
    } else if (obj.startsWith(CLASS_OBJECT_PREFIX)) {
      if (isHierarchy) {
        result.orgHierarchy.push(tuple);
      } else {
        result.classMemberships.push(tuple);
      }
    } else if (isOrgObject(obj)) {
      if (isHierarchy) {
        result.orgHierarchy.push(tuple);
      } else {
        result.orgMemberships.push(tuple);
      }
    }
  }

  return result;
}

/**
 * Check if an object string starts with a district: or school: prefix.
 *
 * @param obj - The FGA object string
 * @returns true if the object is a district or school
 */
function isOrgObject(obj: string): boolean {
  for (const prefix of ORG_OBJECT_PREFIXES) {
    if (obj.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Result of diffing desired tuples against existing FGA tuples.
 */
export interface DiffResult {
  /** Tuples present in desired but not in existing — need to be written. */
  toWrite: (TupleKey | TupleKeyWithoutCondition)[];
  /** Tuples present in existing but not in desired — need to be deleted. */
  toDelete: TupleKey[];
}

/**
 * Diff desired tuples (from Postgres) against existing tuples (from FGA).
 *
 * Uses Set-based comparison on serialized tuple keys:
 * - In desired but not existing → write
 * - In existing but not desired → delete
 * - In both → skip
 *
 * @param desired - Tuples derived from Postgres data
 * @param existing - Tuples currently in FGA
 * @returns DiffResult with toWrite and toDelete arrays
 */
export function diffTuples(desired: (TupleKey | TupleKeyWithoutCondition)[], existing: TupleKey[]): DiffResult {
  const desiredKeys = new Map<string, TupleKey | TupleKeyWithoutCondition>();
  for (const tuple of desired) {
    desiredKeys.set(serializeTupleKey(tuple), tuple);
  }

  const existingKeys = new Map<string, TupleKey>();
  for (const tuple of existing) {
    existingKeys.set(serializeTupleKey(tuple), tuple);
  }

  const toWrite: (TupleKey | TupleKeyWithoutCondition)[] = [];
  for (const [key, tuple] of desiredKeys) {
    if (!existingKeys.has(key)) {
      toWrite.push(tuple);
    }
  }

  const toDelete: TupleKey[] = [];
  for (const [key, tuple] of existingKeys) {
    if (!desiredKeys.has(key)) {
      toDelete.push(tuple);
    }
  }

  return { toWrite, toDelete };
}
