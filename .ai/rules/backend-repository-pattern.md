---
title: Backend Repository Pattern
description: How repositories are structured — extend BaseRepository, inject the DB client, follow the listAll/listAuthorized naming convention.
impact: HIGH
scope: backend
tags: architecture, repositories, database, drizzle
---

## Backend repository pattern

Repositories are the data access layer. They extend `BaseRepository` for standard CRUD, accept a DB client as a default parameter for testability, and follow a consistent naming convention for authorized vs unrestricted queries.

### Incorrect

```typescript
// Throwing ApiError in the repository — error semantics belong in the service
async getById(id: string) {
  const item = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!item[0]) throw new ApiError('Not found', { statusCode: 404 });
  return item[0];
}

// Skipping the access control join — returns data the user shouldn't see
async listAuthorized(filter: AccessControlFilter, options: ListOptions) {
  return this.getAll(options); // no filtering!
}
```

### Correct

`BaseRepository<TEntity, TTable>` provides: `getById`, `get`, `getAll`, `create`, `createMany`, `update`, `delete`, `count`, `runTransaction`.

```typescript
export class MyResourceRepository extends BaseRepository<MyResource, typeof myResources> {
  private readonly accessControls: MyResourceAccessControls;

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    accessControls: MyResourceAccessControls = new MyResourceAccessControls(db),
  ) {
    super(db, myResources);
    this.accessControls = accessControls;
  }
}
```

The DB client defaults to the production client but can be injected for testing. Access control classes are injected the same way.

Most repositories extend `BaseRepository`, but it's not required. `AdministrationTaskVariantRepository` is a standalone class because it's a read-only query across a junction table — it joins `administration_task_variants` → `task_variants` → `tasks` and returns a `Map` for bulk embed resolution. It has no use for standard CRUD methods, so extending `BaseRepository` would be misleading.

Not all repositories use `CoreDbSchema` either — repositories that query the assessment database (e.g., `RunsRepository`) use `AssessmentDbSchema` and `AssessmentDbClient` instead.

### Method naming convention

Repositories provide paired methods — unrestricted for super admins and authorized for regular users:

| Pattern | Used by | Purpose |
|---------|---------|---------|
| `listAll(options)` | Super admins | No access filtering |
| `listAuthorized(filter, options)` | Regular users | Joins against access control subquery |
| `getAuthorizedById(filter, id)` | Regular users | Verifies user can access a specific resource |
| `getResourceByParentId(parentId, options)` | Super admins | Unrestricted sub-resource listing |
| `getAuthorizedResourceByParentId(filter, parentId, options)` | Regular users | Filtered sub-resource listing |

The `filter` parameter is an `AccessControlFilter` (`{ userId, allowedRoles }`), validated via `parseAccessControlFilter()`.

### Authorization join pattern

Authorized methods use an `INNER JOIN` against an access control subquery to filter results in a single round-trip:

```typescript
async listAuthorized(
  filter: AccessControlFilter,
  options: ListOptions,
): Promise<PaginatedResult<MyResource>> {
  const accessible = this.accessControls
    .buildUserResourceIdsQuery(filter)
    .as('accessible');

  const items = await this.db
    .selectDistinct({ resource: myResources })
    .from(myResources)
    .innerJoin(accessible, eq(myResources.id, accessible.resourceId))
    .where(statusFilter)
    .orderBy(sortDirection)
    .limit(perPage)
    .offset(offset);

  return { items, totalItems };
}
```

### Pagination

`BaseRepository.getAll()` handles pagination with a secondary sort on `id` as a tiebreaker to ensure stable ordering across pages:

```typescript
// Offset calculation
const offset = (page - 1) * perPage;

// Always add secondary sort to prevent duplicate/missing rows across pages
.orderBy(primarySort, asc(table.id))
.limit(perPage)
.offset(offset)
```

### Sort column mapping

Map sort field strings to Drizzle column references explicitly:

```typescript
const SORT_COLUMNS = {
  createdAt: myResources.createdAt,
  name: myResources.name,
} as const;

// Usage — safe because the API contract validates the field name
const sortColumn = SORT_COLUMNS[sortBy];
```

### Access controls (`repositories/access-controls/`)

Access control classes build the SQL subqueries that power the authorized repository methods. See `backend-authorization-pattern.md` for the full pattern. Key classes:

- `AdministrationAccessControls` — builds the 6-path UNION query for administration access
- `OrgAccessControls` — builds org access queries (ancestor + descendant visibility)

Access controls are injected as constructor parameters so that tests can substitute mocks without touching the real SQL
subqueries.

### Error handling

Repositories don't catch or throw errors — they let database errors bubble up to the service layer, which wraps them in `ApiError` with appropriate context. See `backend-error-handling.md`.

### The principle

Repositories are deliberately thin — they translate between the application and the database, nothing more. Authorization is expressed as SQL joins, not application logic, because the database is the only place where we can efficiently combine access filtering with data fetching in a single query. Error interpretation is left to services because a `null` result means different things in different contexts (404 for `getById`, empty list for `list`).
