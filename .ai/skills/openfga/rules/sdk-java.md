---
title: Java SDK
impact: HIGH
impactDescription: client implementation for Java
tags: sdk, java, jvm, client
---

## Java SDK

The OpenFGA Java SDK provides the official client for JVM applications. Requires Java 11+.

### Installation

**Maven:**

```xml
<dependency>
    <groupId>dev.openfga</groupId>
    <artifactId>openfga-sdk</artifactId>
    <version>0.7.0</version>
</dependency>
```

**Gradle:**

```groovy
implementation 'dev.openfga:openfga-sdk:0.7.0'
```

### Client Initialization

**Basic setup:**

```java
import dev.openfga.sdk.api.client.OpenFgaClient;
import dev.openfga.sdk.api.configuration.ClientConfiguration;

var config = new ClientConfiguration()
        .apiUrl(System.getenv("FGA_API_URL"))
        .storeId(System.getenv("FGA_STORE_ID"))
        .authorizationModelId(System.getenv("FGA_MODEL_ID"));

var fgaClient = new OpenFgaClient(config);
```

**With API Token:**

```java
import dev.openfga.sdk.api.configuration.Credentials;
import dev.openfga.sdk.api.configuration.ApiToken;

var config = new ClientConfiguration()
        .apiUrl(System.getenv("FGA_API_URL"))
        .storeId(System.getenv("FGA_STORE_ID"))
        .credentials(new Credentials(
            new ApiToken(System.getenv("FGA_API_TOKEN"))));

var fgaClient = new OpenFgaClient(config);
```

**With Client Credentials (OAuth2):**

```java
import dev.openfga.sdk.api.configuration.ClientCredentials;

var config = new ClientConfiguration()
        .apiUrl(System.getenv("FGA_API_URL"))
        .credentials(new Credentials(
            new ClientCredentials()
                    .apiTokenIssuer(System.getenv("FGA_API_TOKEN_ISSUER"))
                    .apiAudience(System.getenv("FGA_API_AUDIENCE"))
                    .clientId(System.getenv("FGA_CLIENT_ID"))
                    .clientSecret(System.getenv("FGA_CLIENT_SECRET"))));

var fgaClient = new OpenFgaClient(config);
```

### Load Authorization Model from File

**From JSON file:**

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.openfga.sdk.api.model.WriteAuthorizationModelRequest;
import java.io.File;

ObjectMapper mapper = new ObjectMapper();

// Read and parse JSON file
WriteAuthorizationModelRequest body = mapper.readValue(
    new File("model.json"),
    WriteAuthorizationModelRequest.class
);

var response = fgaClient.writeAuthorizationModel(body).get();
// response.getAuthorizationModelId() contains the new model ID
```

**From DSL (.fga) file:**

Use the `openfga-language` package to transform DSL to JSON.

**Maven:**

```xml
<dependency>
    <groupId>dev.openfga</groupId>
    <artifactId>openfga-language</artifactId>
    <version>0.2.0</version>
</dependency>
```

**Gradle:**

```groovy
implementation 'dev.openfga:openfga-language:0.2.0'
```

**Transform DSL to JSON:**

```java
import dev.openfga.language.DslToJsonTransformer;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.openfga.sdk.api.model.WriteAuthorizationModelRequest;
import java.nio.file.Files;
import java.nio.file.Path;

// Read DSL file
String dslContent = Files.readString(Path.of("model.fga"));

// Transform DSL to JSON
String jsonString = new DslToJsonTransformer().transform(dslContent);

// Parse JSON into request body
ObjectMapper mapper = new ObjectMapper();
WriteAuthorizationModelRequest body = mapper.readValue(
    jsonString,
    WriteAuthorizationModelRequest.class
);

var response = fgaClient.writeAuthorizationModel(body).get();
// response.getAuthorizationModelId() contains the new model ID
```

**Validate DSL before transforming:**

```java
import dev.openfga.language.validation.ModelValidator;
import dev.openfga.language.errors.DslErrorsException;

try {
    ModelValidator.validateDsl(dslContent);
} catch (DslErrorsException e) {
    // Handle validation errors
    System.err.println("DSL errors: " + e.getErrors());
}
```

**Alternative: Use CLI for conversion**

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```java
import dev.openfga.sdk.api.client.model.ClientCheckRequest;

var request = new ClientCheckRequest()
    .user("user:anne")
    .relation("viewer")
    ._object("document:roadmap");

var response = fgaClient.check(request).get();
// response.getAllowed() returns true/false
```

### Batch Check

```java
import dev.openfga.sdk.api.client.model.ClientBatchCheckRequest;
import dev.openfga.sdk.api.client.model.ClientBatchCheckItem;

var request = new ClientBatchCheckRequest().checks(
    List.of(
        new ClientBatchCheckItem()
            .user("user:anne")
            .relation("viewer")
            ._object("document:roadmap")
            .correlationId("check-1"),
        new ClientBatchCheckItem()
            .user("user:bob")
            .relation("editor")
            ._object("document:budget")
            .correlationId("check-2")));

var options = new ClientBatchCheckOptions()
    .maxParallelRequests(5)
    .maxBatchSize(20);

var response = fgaClient.batchCheck(request, options).get();
```

### Write Tuples

```java
import dev.openfga.sdk.api.client.model.ClientWriteRequest;
import dev.openfga.sdk.api.model.TupleKey;

var request = new ClientWriteRequest()
    .writes(List.of(
        new TupleKey()
            .user("user:anne")
            .relation("viewer")
            ._object("document:roadmap")))
    .deletes(List.of(
        new TupleKey()
            .user("user:bob")
            .relation("editor")
            ._object("document:budget")));

var response = fgaClient.write(request).get();
```

### List Objects

```java
import dev.openfga.sdk.api.client.model.ClientListObjectsRequest;

var request = new ClientListObjectsRequest()
    .user("user:anne")
    .relation("viewer")
    .type("document");

var response = fgaClient.listObjects(request).get();
// response.getObjects() returns accessible document IDs
```

### List Relations

```java
import dev.openfga.sdk.api.client.model.ClientListRelationsRequest;

var request = new ClientListRelationsRequest()
    .user("user:anne")
    ._object("document:roadmap")
    .relations(List.of("can_view", "can_edit", "can_delete"));

var response = fgaClient.listRelations(request).get();
// response.getRelations() returns applicable relations
```

### List Users

```java
import dev.openfga.sdk.api.client.model.ClientListUsersRequest;
import dev.openfga.sdk.api.model.FgaObject;
import dev.openfga.sdk.api.model.UserTypeFilter;

var userFilters = new ArrayList<UserTypeFilter>() {{
    add(new UserTypeFilter().type("user"));
}};

var request = new ClientListUsersRequest()
    ._object(new FgaObject().type("document").id("roadmap"))
    .relation("can_read")
    .userFilters(userFilters);

var response = fgaClient.listUsers(request).get();
// response.getUsers() returns matching users
```

### Read Tuples

```java
import dev.openfga.sdk.api.client.model.ClientReadRequest;

var request = new ClientReadRequest()
    .user("user:anne")
    .relation("viewer")
    ._object("document:roadmap");

var response = fgaClient.read(request).get();
```

### Non-Transaction Write Mode

```java
var options = new ClientWriteOptions()
    .disableTransactions(true)
    .transactionChunkSize(100);

var response = fgaClient.write(request, options).get();
```

### Handle Write Conflicts

```java
import dev.openfga.sdk.api.model.WriteRequestWrites;
import dev.openfga.sdk.api.model.WriteRequestDeletes;

var options = new ClientWriteOptions()
    .onDuplicate(WriteRequestWrites.OnDuplicateEnum.IGNORE)
    .onMissing(WriteRequestDeletes.OnMissingEnum.IGNORE);

var response = fgaClient.write(request, options).get();
```

### Contextual Tuples

```java
var request = new ClientCheckRequest()
    .user("user:anne")
    .relation("viewer")
    ._object("document:roadmap")
    .contextualTuples(List.of(
        new ClientTupleKey()
            .user("user:anne")
            .relation("editor")
            ._object("document:roadmap")));

var response = fgaClient.check(request).get();
```

### Retry Configuration

```java
var config = new ClientConfiguration()
        .apiUrl("http://localhost:8080")
        .maxRetries(3)
        .minimumRetryDelay(Duration.ofMillis(250));

var fgaClient = new OpenFgaClient(config);
```

### Best Practices

- **Initialize once:** Create `OpenFgaClient` once and reuse throughout your application
- **Async handling:** Use `.get()` to block or `.thenApply()` for async
- **Object naming:** Use `._object()` (with underscore) for object parameter
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Java version:** Requires Java 11+
