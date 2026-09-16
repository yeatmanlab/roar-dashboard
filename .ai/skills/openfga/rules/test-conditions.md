---
title: Testing Conditions
impact: MEDIUM
impactDescription: verify dynamic authorization
tags: testing, conditions, context, dynamic
---

## Testing Conditions

Test conditional relationships by providing context in your assertions.

**Example model:**

```dsl.openfga
model
  schema 1.1

type user

type resource
  relations
    define viewer: [user with in_allowed_ip_range]

condition in_allowed_ip_range(user_ip: string, allowed_range: string) {
  user_ip.startsWith(allowed_range)
}
```

**Conditional tuple:**

```yaml
tuples:
  - user: user:anne
    relation: viewer
    object: resource:internal
    condition:
      name: in_allowed_ip_range
      context:
        allowed_range: "192.168."
```

**Tests with context:**

```yaml
tests:
  - name: Conditional access tests
    check:
      # Access granted - IP matches
      - user: user:anne
        object: resource:internal
        context:
          user_ip: "192.168.1.100"
        assertions:
          viewer: true

      # Access denied - IP doesn't match
      - user: user:anne
        object: resource:internal
        context:
          user_ip: "10.0.0.50"
        assertions:
          viewer: false
```

**Time-based condition testing:**

```yaml
tests:
  - name: Time-based access
    check:
      # Within valid window
      - user: user:peter
        object: organization:acme
        context:
          current_time: "2024-02-01T00:10:00Z"
        assertions:
          admin: true

      # After window expired
      - user: user:peter
        object: organization:acme
        context:
          current_time: "2024-02-02T00:00:00Z"
        assertions:
          admin: false
```

**Always test both passing and failing condition evaluations.**
