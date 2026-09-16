---
title: Go SDK
impact: HIGH
impactDescription: client implementation for Go
tags: sdk, go, golang, client
---

## Go SDK

The `github.com/openfga/go-sdk` package provides the official OpenFGA client for Go applications.

### Installation

```bash
go get -u github.com/openfga/go-sdk
go mod tidy
```

### Client Initialization

**Basic setup:**

```go
import openfga "github.com/openfga/go-sdk"

fgaClient, err := NewSdkClient(&ClientConfiguration{
    ApiUrl:               os.Getenv("FGA_API_URL"),
    StoreId:              os.Getenv("FGA_STORE_ID"),
    AuthorizationModelId: os.Getenv("FGA_MODEL_ID"),
})
```

**With API Token:**

```go
import "github.com/openfga/go-sdk/credentials"

fgaClient, err := NewSdkClient(&ClientConfiguration{
    ApiUrl:  os.Getenv("FGA_API_URL"),
    StoreId: os.Getenv("FGA_STORE_ID"),
    Credentials: &credentials.Credentials{
        Method: credentials.CredentialsMethodApiToken,
        Config: &credentials.Config{
            ApiToken: os.Getenv("FGA_API_TOKEN"),
        },
    },
})
```

**With Client Credentials (OAuth2):**

```go
fgaClient, err := NewSdkClient(&ClientConfiguration{
    ApiUrl: os.Getenv("FGA_API_URL"),
    Credentials: &credentials.Credentials{
        Method: credentials.CredentialsMethodClientCredentials,
        Config: &credentials.Config{
            ClientCredentialsClientId:       os.Getenv("FGA_CLIENT_ID"),
            ClientCredentialsClientSecret:   os.Getenv("FGA_CLIENT_SECRET"),
            ClientCredentialsApiAudience:    os.Getenv("FGA_API_AUDIENCE"),
            ClientCredentialsApiTokenIssuer: os.Getenv("FGA_API_TOKEN_ISSUER"),
        },
    },
})
```

### Check Permission

```go
data, err := fgaClient.Check(context.Background()).
    Body(ClientCheckRequest{
        User:     "user:anne",
        Relation: "viewer",
        Object:   "document:roadmap",
    }).
    Execute()
fmt.Printf("allowed: %t", data.GetAllowed())
```

### Batch Check

```go
body := ClientBatchCheckRequest{
    Checks: []ClientBatchCheckItem{{
        CorrelationId: "check-1",
        User:          "user:anne",
        Relation:      "viewer",
        Object:        "document:roadmap",
    }},
}
data, err := fgaClient.BatchCheck(context.Background()).Body(body).Execute()
// Results keyed by correlationId
```

### Write Tuples

```go
body := ClientWriteRequest{
    Writes: &[]ClientTupleKey{{
        User:     "user:anne",
        Relation: "viewer",
        Object:   "document:roadmap",
    }},
    Deletes: &[]ClientTupleKeyWithoutCondition{{
        User:     "user:bob",
        Relation: "editor",
        Object:   "document:budget",
    }},
}
err := fgaClient.Write(context.Background()).Body(body).Execute()
```

### List Objects

```go
data, err := fgaClient.ListObjects(context.Background()).
    Body(ClientListObjectsRequest{
        User:     "user:anne",
        Relation: "can_read",
        Type:     "document",
    }).
    Execute()
// data.Objects contains accessible object IDs
```

### Streamed List Objects

```go
response, err := fgaClient.StreamedListObjects(context.Background()).
    Body(ClientStreamedListObjectsRequest{
        User:     "user:anne",
        Relation: "can_read",
        Type:     "document",
    }).
    Execute()
defer response.Close()

for obj := range response.Objects {
    objects = append(objects, obj.Object)
}
```

### List Relations

```go
data, err := fgaClient.ListRelations(context.Background()).
    Body(ClientListRelationsRequest{
        User:      "user:anne",
        Object:    "document:roadmap",
        Relations: []string{"can_view", "can_edit"},
    }).
    Execute()
// data.Relations contains applicable relations
```

### List Users

```go
data, err := fgaClient.ListUsers(context.Background()).
    Body(ClientListUsersRequest{
        Object:      openfga.FgaObject{Type: "document", Id: "roadmap"},
        Relation:    "can_read",
        UserFilters: []openfga.UserTypeFilter{{Type: "user"}},
    }).
    Execute()
```

### Read Tuples

```go
data, err := fgaClient.Read(context.Background()).
    Body(ClientReadRequest{
        User:     openfga.PtrString("user:anne"),
        Relation: openfga.PtrString("viewer"),
        Object:   openfga.PtrString("document:roadmap"),
    }).
    Execute()
```

### Non-Transaction Write Mode

```go
options := ClientWriteOptions{
    Transaction: &TransactionOptions{
        Disable:             true,
        MaxParallelRequests: 5,
        MaxPerChunk:         100,
    },
}
data, err := fgaClient.Write(context.Background()).
    Body(body).
    Options(options).
    Execute()
```

### Load Authorization Model from File

**From JSON file:**

```go
import (
    "encoding/json"
    "os"
    openfga "github.com/openfga/go-sdk"
)

// Read JSON file
jsonContent, err := os.ReadFile("model.json")
if err != nil {
    log.Fatal(err)
}

// Parse into request body
var body openfga.WriteAuthorizationModelRequest
if err := json.Unmarshal(jsonContent, &body); err != nil {
    log.Fatal(err)
}

// Write the model
response, err := fgaClient.WriteAuthorizationModel(context.Background()).
    Body(body).
    Execute()
```

**From DSL (.fga) file:**

Install the language transformer:

```bash
go get github.com/openfga/language/pkg/go/transformer
```

```go
import (
    "encoding/json"
    "os"
    "github.com/openfga/language/pkg/go/transformer"
    openfga "github.com/openfga/go-sdk"
)

// Read DSL file
dslContent, err := os.ReadFile("model.fga")
if err != nil {
    log.Fatal(err)
}

// Transform DSL to JSON
jsonModel, err := transformer.TransformDSLToJSON(string(dslContent))
if err != nil {
    log.Fatal(err)
}

// Parse into request body
var body openfga.WriteAuthorizationModelRequest
if err := json.Unmarshal([]byte(jsonModel), &body); err != nil {
    log.Fatal(err)
}

// Write the model
response, err := fgaClient.WriteAuthorizationModel(context.Background()).
    Body(body).
    Execute()
```

### Contextual Tuples

```go
body := ClientCheckRequest{
    User:     "user:anne",
    Relation: "viewer",
    Object:   "document:roadmap",
    ContextualTuples: &[]ClientTupleKey{{
        User:     "user:anne",
        Relation: "editor",
        Object:   "document:roadmap",
    }},
}
```

### Retry Configuration

```go
fgaClient, err := NewSdkClient(&ClientConfiguration{
    RetryParams: &openfga.RetryParams{
        MaxRetry:    3,
        MinWaitInMs: 250,
    },
})
```

### Best Practices

- **Initialize once:** Create the client once and reuse throughout your application
- **Use context:** Always pass `context.Context` for cancellation and timeouts
- **Pointer helpers:** Use `openfga.PtrString()` for optional string parameters
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Streaming:** Use `StreamedListObjects` for large result sets
