---
title: .NET SDK
impact: HIGH
impactDescription: client implementation for .NET
tags: sdk, dotnet, csharp, client
---

## .NET SDK

The `OpenFga.Sdk` package provides the official OpenFGA client for .NET applications.

### Installation

```powershell
dotnet add package OpenFga.Sdk
```

Supported frameworks: `net8.0`, `net9.0`, `netstandard2.0`, `net48`

### Client Initialization

**Basic setup:**

```csharp
using OpenFga.Sdk.Client;
using OpenFga.Sdk.Configuration;

var configuration = new ClientConfiguration() {
    ApiUrl = "http://localhost:8080",
    StoreId = Environment.GetEnvironmentVariable("FGA_STORE_ID"),
    AuthorizationModelId = Environment.GetEnvironmentVariable("FGA_MODEL_ID"),
};
var fgaClient = new OpenFgaClient(configuration);
```

**With API Token:**

```csharp
using OpenFga.Sdk.Configuration;

var configuration = new ClientConfiguration() {
    ApiUrl = Environment.GetEnvironmentVariable("FGA_API_URL"),
    StoreId = Environment.GetEnvironmentVariable("FGA_STORE_ID"),
    Credentials = new Credentials() {
        Method = CredentialsMethod.ApiToken,
        Config = new CredentialsConfig() {
            ApiToken = Environment.GetEnvironmentVariable("FGA_API_TOKEN"),
        }
    }
};
var fgaClient = new OpenFgaClient(configuration);
```

**With Client Credentials (OAuth2):**

```csharp
var configuration = new ClientConfiguration() {
    ApiUrl = Environment.GetEnvironmentVariable("FGA_API_URL"),
    Credentials = new Credentials() {
        Method = CredentialsMethod.ClientCredentials,
        Config = new CredentialsConfig() {
            ApiTokenIssuer = Environment.GetEnvironmentVariable("FGA_API_TOKEN_ISSUER"),
            ApiAudience = Environment.GetEnvironmentVariable("FGA_API_AUDIENCE"),
            ClientId = Environment.GetEnvironmentVariable("FGA_CLIENT_ID"),
            ClientSecret = Environment.GetEnvironmentVariable("FGA_CLIENT_SECRET"),
        }
    }
};
var fgaClient = new OpenFgaClient(configuration);
```

### Load Authorization Model from File

**From JSON file:**

```csharp
using System.Text.Json;
using OpenFga.Sdk.Model;

// Read and parse JSON file
var jsonContent = await File.ReadAllTextAsync("model.json");
var modelJson = JsonSerializer.Deserialize<WriteAuthorizationModelRequest>(jsonContent);

var response = await fgaClient.WriteAuthorizationModel(modelJson);
// response.AuthorizationModelId contains the new model ID
```

**From DSL (.fga) file:**

The .NET SDK does not include a built-in DSL parser. Convert DSL files to JSON using the OpenFGA CLI, then load the JSON file.

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```csharp
using OpenFga.Sdk.Client.Model;

var body = new ClientCheckRequest {
    User = "user:anne",
    Relation = "viewer",
    Object = "document:roadmap"
};
var response = await fgaClient.Check(body);
// response.Allowed = true/false
```

### Batch Check

```csharp
var options = new ClientBatchCheckOptions {
    MaxParallelRequests = 5,
    MaxBatchSize = 20,
};
var body = new ClientBatchCheckRequest {
    Checks = new List<ClientBatchCheckItem>() {
        new() {
            User = "user:anne",
            Relation = "viewer",
            Object = "document:roadmap",
            CorrelationId = "check-1",
        },
        new() {
            User = "user:bob",
            Relation = "editor",
            Object = "document:budget",
            CorrelationId = "check-2",
        }
    }
};
var response = await fgaClient.BatchCheck(body, options);
```

### Write Tuples

```csharp
var body = new ClientWriteRequest() {
    Writes = new List<ClientTupleKey> {
        new() {
            User = "user:anne",
            Relation = "viewer",
            Object = "document:roadmap",
        }
    },
    Deletes = new List<ClientTupleKeyWithoutCondition> {
        new() {
            User = "user:bob",
            Relation = "editor",
            Object = "document:budget",
        }
    },
};
var response = await fgaClient.Write(body);
```

### List Objects

```csharp
var body = new ClientListObjectsRequest {
    User = "user:anne",
    Relation = "viewer",
    Type = "document",
};
var response = await fgaClient.ListObjects(body);
// response.Objects contains accessible document IDs
```

### Streamed List Objects

```csharp
var options = new ClientListObjectsOptions {
    Consistency = ConsistencyPreference.HIGHERCONSISTENCY
};

var objects = new List<string>();
await foreach (var response in fgaClient.StreamedListObjects(
    new ClientListObjectsRequest {
        User = "user:anne",
        Relation = "can_read",
        Type = "document"
    },
    options)) {
    objects.Add(response.Object);
}
```

### List Relations

```csharp
var body = new ClientListRelationsRequest() {
    User = "user:anne",
    Object = "document:roadmap",
    Relations = new List<string> {"can_view", "can_edit", "can_delete"},
};
var response = await fgaClient.ListRelations(body);
// response.Relations contains applicable relations
```

### List Users

```csharp
using OpenFga.Sdk.Model;

var body = new ClientListUsersRequest() {
    Object = new FgaObject() {
        Type = "document",
        Id = "roadmap"
    },
    Relation = "can_read",
    UserFilters = new List<UserTypeFilter> {
        new() { Type = "user" }
    },
};
var response = await fgaClient.ListUsers(body);
```

### Read Tuples

```csharp
var body = new ClientReadRequest() {
    User = "user:anne",
    Relation = "viewer",
    Object = "document:roadmap",
};
var response = await fgaClient.Read(body);
```

### Non-Transaction Write Mode

```csharp
var options = new ClientWriteOptions {
    Transaction = new TransactionOptions() {
        Disable = true,
        MaxParallelRequests = 5,
        MaxPerChunk = 100,
    }
};
var response = await fgaClient.Write(body, options);
```

### Handle Write Conflicts

```csharp
var options = new ClientWriteOptions {
    Conflict = new ConflictOptions {
        OnDuplicateWrites = OnDuplicateWrites.Ignore,
        OnMissingDeletes = OnMissingDeletes.Ignore
    }
};
var response = await fgaClient.Write(body, options);
```

### Contextual Tuples

```csharp
var body = new ClientCheckRequest {
    User = "user:anne",
    Relation = "viewer",
    Object = "document:roadmap",
    ContextualTuples = new List<ClientTupleKey> {
        new() {
            User = "user:anne",
            Relation = "editor",
            Object = "document:roadmap",
        },
    },
};
var response = await fgaClient.Check(body);
```

### Retry Configuration

```csharp
var configuration = new ClientConfiguration() {
    ApiUrl = "http://localhost:8080",
    RetryParams = new RetryParams() {
        MaxRetry = 3,
        MinWaitInMs = 250
    }
};
var fgaClient = new OpenFgaClient(configuration);
```

### Per-Request Headers

```csharp
var options = new ClientCheckOptions {
    Headers = new Dictionary<string, string> {
        { "X-Request-ID", "123e4567-e89b-12d3-a456-426614174000" }
    }
};
var response = await fgaClient.Check(body, options);
```

### Best Practices

- **Initialize once:** Create `OpenFgaClient` once and reuse throughout your application
- **Async/await:** All methods are async - use `await` properly
- **Streaming:** Use `StreamedListObjects` with `await foreach` for large result sets
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Retry-After:** SDK respects the `Retry-After` header with exponential backoff
