---
title: Backend Service Pattern
description: Services are closure-based functions with dependency injection via default parameters — no classes, no DI framework.
impact: HIGH
scope: backend
tags: architecture, services, testing, dependency-injection
---

## Backend service pattern

Services are plain functions that take their dependencies as optional parameters, default to real implementations, and return an object of methods. This gives us dependency injection for testing without a DI framework or class boilerplate.

### Incorrect

```typescript
// Class-based service — unnecessary complexity for what's just a bag of functions
export class ResourceService {
  constructor(private readonly repo: ResourceRepository) {}
  async list() { /* ... */ }
}

// Exporting individual functions — loses the DI boundary
export async function list(repo = new ResourceRepository()) { /* ... */ }
export async function getById(repo = new ResourceRepository()) { /* ... */ }
```

### Correct

```typescript
export function ResourceService({
  resourceRepository = new ResourceRepository(),
  otherService = OtherService(),
}: {
  resourceRepository?: ResourceRepository;
  otherService?: ReturnType<typeof OtherService>;
} = {}) {
  // Private helpers (closure-scoped, not exposed)
  async function verifyResourceAccess(authContext: AuthContext, id: string) {
    // ... shared authorization logic
  }

  // Public methods
  async function list(authContext: AuthContext, options: ListOptions) {
    // ...
  }

  async function getById(authContext: AuthContext, id: string) {
    return verifyResourceAccess(authContext, id);
  }

  return { list, getById };
}
```

Key details:
- **Default `= {}`** on the params object lets callers create a service with zero arguments: `ResourceService()`
- **Repositories** are instantiated with `new Repo()`. **Other services** are instantiated by calling their constructor function: `OtherService()`
- **Return type** is a plain object of async functions — no class, no prototype
- **Private helpers** like `verifyResourceAccess` live inside the closure and aren't returned

When a dependency shouldn't be created at import time (e.g., the DB client isn't initialized yet), use lazy initialization instead of a default parameter:

```typescript
export function ResourceService({
  resourceRepository,
}: {
  resourceRepository?: ResourceRepository;
} = {}) {
  const repo = resourceRepository ?? new ResourceRepository();
  // ...
}
```

### How services are instantiated

Controllers create a single service instance at module level using defaults:

```typescript
const myResourceService = ResourceService();
```

Tests inject mocks via the constructor parameters:

```typescript
const service = ResourceService({
  resourceRepository: mockRepository,
});
```

### The principle

This pattern hits the sweet spot between simplicity and testability. Production code calls `ResourceService()` with no arguments and gets real dependencies. Test code passes in mocks. Private helpers stay private via closure scope rather than visibility modifiers. There's no DI container to configure, no decorators to maintain, and no class boilerplate — just functions.
