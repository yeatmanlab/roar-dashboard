---
title: Code Style
description: Constants over magic values, consistent naming conventions, structured logging, purposeful documentation that explains why, not what.
impact: MEDIUM
scope: shared
tags: naming, constants, logging, documentation, comments, style
---

## Code style

These conventions apply across the monorepo — backend, frontend, and shared packages.

### Incorrect

```typescript
// Magic numbers and strings
if (userRoles.length > 3) { /* ... */ }
const status = 'active';
const timeout = 30000;

// String interpolation in structured logger
logger.error(`Failed to get admin ${id} for user ${userId}`);

// Comment restating what the code does
// Check if user is super admin
if (authContext.isSuperAdmin) { /* ... */ }
```

### Correct

```typescript
// Constants over magic values
const MAX_ROLES_PER_USER = 3;
if (userRoles.length > MAX_ROLES_PER_USER) { /* ... */ }
const status = AdministrationStatus.ACTIVE;
const timeout = AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD;

// Structured logging — context object first (pino convention), message second
logger.error({ err: error, context: { userId, administrationId } }, 'Failed to retrieve administration');

// Comment explains why, not what
// Super admins bypass role checks — they have implicit access to all resources
if (authContext.isSuperAdmin) { /* ... */ }
```

### Conventions

**Constants:** Use enum or constant files for domain values (permissions, roles, statuses, configuration thresholds). Group related constants in a single file. Backend uses `as const`, frontend uses `Object.freeze()`.

**Naming:**

| Element | Convention | Example |
|---------|-----------|---------|
| Files (backend) | kebab-case with layer suffix | `administration.service.ts`, `base.repository.ts` |
| Files (frontend components) | PascalCase | `TextInput.vue`, `ScoreReport.vue` |
| Files (frontend composables) | camelCase with `use` prefix | `useDebounce.js`, `useUserType.js` |
| Functions / methods | camelCase | `verifyAdministrationAccess`, `getById` |
| Types / interfaces | PascalCase | `AuthContext`, `ListOptions` |
| Constants | UPPER_SNAKE_CASE | `SUPERVISORY_ROLES`, `API_ROUTES` |
| Test files (unit) | `.test.ts` / `.test.js` | `user.service.test.ts` |
| Test files (integration) | `.integration.test.ts` | `administration.repository.integration.test.ts` |

**Logging:** Never use string interpolation for log messages. Always pass context as a structured object so it's searchable and filterable.

**Documentation:** We value purposeful inline documentation. Code should be self-documenting through clear naming and small functions, but JSDoc/TSDoc adds real value when it explains intent, authorization behavior, or non-obvious logic.

All public functions and methods should have JSDoc with `@param` and `@returns`. Scale the description to the complexity:

```typescript
// Simple utility — one-line description is enough
/**
 * Checks if any of the given roles is a supervisory role.
 *
 * @param roles - Array of role strings to check
 * @returns true if at least one role is in the SUPERVISORY_ROLES allowlist
 */

// Service method — document authorization behavior and failure modes
/**
 * List districts assigned to an administration with access control.
 *
 * Authorization behavior:
 * - Super admin: sees all districts assigned to the administration
 * - Supervisory roles: sees only districts within their accessible org tree
 * - Supervised roles: returns 403 Forbidden
 *
 * @param authContext - User's auth context
 * @param administrationId - The administration to get districts for
 * @param options - Pagination and sorting options
 * @returns Paginated result with districts
 * @throws {ApiError} NOT_FOUND if administration doesn't exist
 * @throws {ApiError} FORBIDDEN if user lacks access
 */
```

Use `@throws` on backend service methods where callers need to know which error codes to expect. Use `@example` selectively — only when usage is non-obvious. Frontend `.js` files use `{Type}` annotations in `@param` tags since they don't have TypeScript types.

**Inline comments:** Explain *why*, not *what*. Use `TODO:` for planned improvements. Reserve inline comments for non-obvious logic — don't restate what the code already says.

### The principle

Consistent style reduces cognitive overhead. Constants prevent typos and make refactoring safe. Structured logging makes production debugging possible. Purposeful JSDoc captures intent and authorization behavior that the code alone can't convey — but comments that merely restate the code become lies when it changes.
