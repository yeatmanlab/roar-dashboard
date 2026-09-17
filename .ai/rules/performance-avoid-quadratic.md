---
title: Avoid O(n²) Algorithms
description: Design for scale. Nested loops over access control results, embed resolution, or pagination are the most common sources of performance problems.
impact: HIGH
scope: backend
tags: performance, algorithms, complexity, scale
---

## Avoid O(n²) algorithms

ROAR serves school districts with thousands of users, hundreds of classes, and deep org hierarchies. What works fine with 10 users or 50 records can collapse at district scale. Performance is something we build correctly from the start, not optimize later.

When building features, ask yourself: "How does this behave with 1,000 users? 10,000 records?"

### Common O(n²) patterns to avoid

- Nested array iterations (`.map` inside `.map`, `.forEach` inside `.forEach`)
- Array methods like `.some`, `.find`, or `.filter` inside loops
- Checking every item against every other item without optimization
- Fetching related data one-by-one inside a loop instead of in bulk

### ROAR-specific hot paths

**Access control queries:** The access control subqueries in `repositories/access-controls/` already use SQL joins to filter in a single round-trip. Don't undo this by post-filtering results in JavaScript.

```typescript
// Incorrect: fetching authorized IDs, then filtering results in a loop
// Note: buildUserResourceIdsQuery returns a SQL subquery; execute it to materialize IDs.
// (Pseudocode) `executeSubquery` represents whatever helper you use to run the subquery.
const authorizedIds = await executeSubquery(
  accessControls.buildUserResourceIdsQuery(filter),
);
const allItems = await repository.listAll(options);
const filtered = allItems.filter(item => authorizedIds.includes(item.id)); // O(n*m)

// Correct: let the database do the filtering via INNER JOIN
const items = await repository.listAuthorized(filter, options); // single query
```

**Embed resolution:** When resolving `?embed=` options, fetch all related data in bulk, then attach via a Map lookup. Don't fetch per-item.

```typescript
// Incorrect: N+1 query pattern
const items = await repository.listAll(options);
for (const item of items) {
  item.stats = await repository.getStatsForItem(item.id); // one query per item
}

// Correct: bulk fetch + Map lookup
const items = await repository.listAll(options);
const ids = items.map(i => i.id);
const statsMap = await repository.getStatsByIds(ids); // one query for all
for (const item of items) {
  item.stats = statsMap.get(item.id); // O(1) lookup
}
```

**Pagination with secondary sort:** `BaseRepository.getAll()` already adds a secondary sort on `id` as a tiebreaker to ensure stable ordering across pages. Don't re-implement pagination logic that skips this.

### Better data structures and algorithms

- **Hash maps/sets:** Use `Map` or `Set` for O(1) lookups instead of `.find` or `.includes` on arrays
- **Bulk fetches:** Fetch related data for all items in one query, then distribute via Map
- **SQL joins:** Let the database handle filtering and joining. It's almost always faster than doing it in JavaScript.
- **Sorting + early exit:** Sort data once, break out of loops when remaining items can't match

### The principle

The most common performance bug in ROAR is not a slow algorithm in the traditional sense. It's fetching data one-by-one inside a loop when a single bulk query would do, or post-filtering in JavaScript what the database could have filtered in SQL. The access control architecture is specifically designed to avoid this. Follow its patterns.
