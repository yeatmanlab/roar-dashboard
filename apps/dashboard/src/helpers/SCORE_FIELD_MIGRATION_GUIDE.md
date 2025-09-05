# Score Field Migration Guide

## Overview

ROAR assessments are in the process of standardizing the field names used to store scores. Eventually, we will want to migrate legacy scores in the database to use these new field names. But in the interim, score reports must support both new standardized field names and legacy field names.

As a result, the score field access system has been completely migrated from the `getScoreKeys` function to the `getScoreValue` function to provide backwards compatibility when field names are updated. This allows score reports to work with both new standardized field names and legacy field names.

## Key Components

### 1. Configuration-Driven Field Mapping

- `SCORE_FIELD_MAPPINGS` object defines new and legacy field names for each task
- Supports grade-dependent field names using functions
- Easy to update when new field names are introduced

### 2. Safe Score Access

- Use `getScoreValue(scoresObject, taskId, grade, fieldType)` for safely accessing scores with automatic fallback.
- This supports Vue reactive values with `toValue()` for grade parameter.
- It validates field types against `ALLOWED_SCORE_FIELD_TYPES`.

## Usage Examples

### Basic Score Access (Recommended)

```js
import { getScoreValue } from '@/helpers/reports';

// Instead of direct property access:
// const percentile = scores.wjPercentile;
// This is not backwards compatible

// Use the safe accessor:
const percentile = getScoreValue(scores, 'swr', grade, 'percentile');
const rawScore = getScoreValue(scores, 'swr', grade, 'rawScore');
const standardScore = getScoreValue(scores, 'swr', grade, 'standardScore');
```

### Supported Field Types

The `fieldType` parameter accepts these validated values:

- `'percentile'` - Percentile score for comparison
- `'percentileDisplay'` - Percentile score formatted for display (may include '>' symbols)
- `'standardScore'` - Standard score for comparison
- `'standardScoreDisplay'` - Standard score formatted for display
- `'rawScore'` - Raw score value

### Updating Field Names

To update field names for a task:

1. Update the `SCORE_FIELD_MAPPINGS` configuration:

```js
swr: {
  percentile: {
    new: 'newPercentileFieldName',  // New standardized name
    legacy: 'wjPercentile',         // Old field name for fallback
  },
  // ... other fields
}
```

1. The system will automatically:
   - Try the new field name first
   - Fall back to legacy field name if new one doesn't exist
   - Return undefined if neither exists

## Migration Strategy

When an assessment version update will introduce new score field names, edit the `SCORE_FIELD_MAPPINGS` object to include the new field names. For example, if SWR is updated to write normed scores under `percentile` rather than the legacy field name `wjPercentile`, then the `SCORE_FIELD_MAPPINGS` object should be updated as follows:

```js
swr: {
  percentile: {
    new: 'percentile',
    legacy: 'wjPercentile',
  },
}
```

## Future Work

Pull all branching logic out of the components and into the `getScoreValue` function. For example, we see these lines in a few places

```js
let rawScore = null;
if (!taskId.includes('vocab') && !taskId.includes('es')) {
  rawScore = getScoreValue(compositeScores, taskId, grade.value, 'rawScore');
} else {
  rawScore = compositeScores;
}
```

It is not clear why this branching logic exists. Why should the `es` tasks be handled differently when there are `es` tasks defined in the `SCORE_FIELD_MAPPINGS` object? P&R should be consulted to understand the reasoning behind this logic. And if it is necessary, the `SCORE_FIELD_MAPPINGS` object should be updated to include all possible tasks.
