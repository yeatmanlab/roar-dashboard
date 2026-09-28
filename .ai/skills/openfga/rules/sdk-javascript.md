---
title: JavaScript/TypeScript SDK
impact: HIGH
impactDescription: client implementation for JS/TS
tags: sdk, javascript, typescript, nodejs, client
---

## JavaScript/TypeScript SDK

The `@openfga/sdk` package provides the official OpenFGA client for JavaScript and TypeScript applications.

### Installation

```bash
npm install @openfga/sdk
```

### Client Initialization

**Basic setup:**

```typescript
const { OpenFgaClient } = require('@openfga/sdk');

const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  storeId: process.env.FGA_STORE_ID,
  authorizationModelId: process.env.FGA_MODEL_ID,
});
```

**With API Token:**

```typescript
const { OpenFgaClient, CredentialsMethod } = require('@openfga/sdk');

const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  storeId: process.env.FGA_STORE_ID,
  credentials: {
    method: CredentialsMethod.ApiToken,
    config: {
      token: process.env.FGA_API_TOKEN,
    }
  }
});
```

**With Client Credentials (OAuth2):**

```typescript
const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  storeId: process.env.FGA_STORE_ID,
  credentials: {
    method: CredentialsMethod.ClientCredentials,
    config: {
      apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER,
      apiAudience: process.env.FGA_API_AUDIENCE,
      clientId: process.env.FGA_CLIENT_ID,
      clientSecret: process.env.FGA_CLIENT_SECRET,
    }
  }
});
```

### Load Authorization Model from File

**From JSON file:**

```typescript
const fs = require('fs');

// Read and parse JSON model
const modelJson = JSON.parse(fs.readFileSync('model.json', 'utf8'));

const { authorization_model_id } = await fgaClient.writeAuthorizationModel(modelJson);
```

**From DSL (.fga) file:**

Use the `@openfga/syntax-transformer` package to convert DSL to JSON:

```bash
npm install @openfga/syntax-transformer
```

```typescript
const fs = require('fs');
const { transformer } = require('@openfga/syntax-transformer');

// Read DSL file and transform to JSON
const dslContent = fs.readFileSync('model.fga', 'utf8');
const modelJson = transformer.transformDSLToJSON(dslContent);

const { authorization_model_id } = await fgaClient.writeAuthorizationModel(
  JSON.parse(modelJson)
);
```

**Alternative: Use CLI for conversion**

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```typescript
const result = await fgaClient.check({
  user: "user:anne",
  relation: "viewer",
  object: "document:roadmap",
});
// result.allowed === true or false
```

### Batch Check

```typescript
const { result } = await fgaClient.batchCheck({
  checks: [
    { user: "user:anne", relation: "viewer", object: "document:roadmap" },
    { user: "user:bob", relation: "editor", object: "document:budget" }
  ]
});
```

### Write Tuples

```typescript
await fgaClient.write({
  writes: [
    { user: "user:anne", relation: "viewer", object: "document:roadmap" }
  ],
  deletes: [
    { user: "user:bob", relation: "editor", object: "document:budget" }
  ],
});

// Convenience methods
await fgaClient.writeTuples([
  { user: "user:anne", relation: "viewer", object: "document:roadmap" }
]);
await fgaClient.deleteTuples([
  { user: "user:bob", relation: "editor", object: "document:budget" }
]);
```

### List Objects

```typescript
const response = await fgaClient.listObjects({
  user: "user:anne",
  relation: "viewer",
  type: "document",
});
// response.objects = ["document:roadmap", "document:budget"]
```

### List Relations

```typescript
const response = await fgaClient.listRelations({
  user: "user:anne",
  object: "document:roadmap",
  relations: ["can_view", "can_edit", "can_delete"],
});
// response.relations = ["can_view", "can_edit"]
```

### List Users

```typescript
const response = await fgaClient.listUsers({
  object: { type: "document", id: "roadmap" },
  relation: "can_read",
  user_filters: [{ type: "user" }],
});
// response.users = [{ object: { type: "user", id: "anne" } }]
```

### Read Tuples

```typescript
const { tuples } = await fgaClient.read({
  user: "user:anne",
  relation: "viewer",
  object: "document:roadmap",
});
```

### Non-Transaction Write Mode

For large batch writes:

```typescript
const response = await fgaClient.write({
  writes: largeTupleArray,
}, {
  transaction: {
    disable: true,
    maxPerChunk: 100,
    maxParallelRequests: 10,
  }
});
```

### Handle Write Conflicts

```typescript
const { ClientWriteRequestOnDuplicateWrites } = require('@openfga/sdk');

await fgaClient.write({
  writes: [{ user: "user:anne", relation: "writer", object: "document:budget" }],
}, {
  conflict: {
    onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore,
  }
});
```

### Retry Configuration

```typescript
const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  retryParams: {
    maxRetry: 3,
    minWaitInMs: 250
  }
});
```

### Best Practices

- **Initialize once:** Create `OpenFgaClient` once and reuse throughout your application
- **Input format:** Parameters use camelCase
- **Response format:** API responses use snake_case
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Batch operations:** Use `correlationId` to match responses to requests
