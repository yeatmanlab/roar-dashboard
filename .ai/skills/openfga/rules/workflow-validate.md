---
title: Always Validate Models
impact: CRITICAL
impactDescription: mandatory workflow step
tags: workflow, validation, testing, mandatory
---

## Always Validate Models

**CRITICAL**: After creating or modifying any `.fga` or `.fga.yaml` file, you MUST immediately run tests to validate the model. Never deliver an untested model.

### Incorrect: Delivering Untested Model

```
1. Create/modify .fga model
2. Create/modify .fga.yaml tests
3. Deliver to user ❌ WRONG
```

The model may have syntax errors, logical errors, or test assertions that don't match actual behavior.

### Correct: Validate Before Delivery

```
1. Create/modify .fga model
2. Create/modify .fga.yaml tests
3. Run: fga model test --tests <file>.fga.yaml ✓
4. If tests fail: fix model or tests, go to step 3
5. Deliver to user with test results ✓
```

### Command

```bash
fga model test --tests <filename>.fga.yaml
```

### Why This Matters

- **Syntax errors**: The DSL parser will catch invalid syntax
- **Logical errors**: Tests verify permissions work as intended
- **Inheritance bugs**: Complex `from` relationships may not behave as expected
- **Missing tuples**: Tests ensure all required tuples exist for assertions

### Example Workflow

```bash
# After creating notion.fga and notion.fga.yaml
$ fga model test --tests notion.fga.yaml

# Expected output for passing tests:
# Test Summary #
Tests 14/14 passing
Checks 123/123 passing
ListObjects 3/3 passing
ListUsers 1/1 passing

# If tests fail, fix the issues and re-run until all pass
```

### Non-Negotiable

This step is **not optional**. An untested authorization model may:
- Grant access to users who shouldn't have it
- Deny access to users who should have it
- Cause security vulnerabilities in production

Always run tests. Always report results to the user.
