---
title: Python SDK
impact: HIGH
impactDescription: client implementation for Python
tags: sdk, python, async, client
---

## Python SDK

The `openfga_sdk` package provides the official OpenFGA client for Python applications with both async and sync support.

### Installation

```bash
pip install openfga_sdk
```

### Client Initialization

**Async client (recommended):**

```python
from openfga_sdk import ClientConfiguration, OpenFgaClient

async def main():
    configuration = ClientConfiguration(
        api_url="http://localhost:8080",
        store_id="YOUR_STORE_ID",
        authorization_model_id="YOUR_MODEL_ID"
    )
    async with OpenFgaClient(configuration) as fga_client:
        result = await fga_client.check(body)
        return result
```

**Synchronous client:**

```python
from openfga_sdk.client import ClientConfiguration
from openfga_sdk.sync import OpenFgaClient

def main():
    configuration = ClientConfiguration(
        api_url="http://localhost:8080",
        store_id="YOUR_STORE_ID"
    )
    with OpenFgaClient(configuration) as fga_client:
        result = fga_client.check(body)
        return result
```

**With API Token:**

```python
from openfga_sdk.credentials import Credentials, CredentialConfiguration

configuration = ClientConfiguration(
    api_url="http://localhost:8080",
    credentials=Credentials(
        method='api_token',
        configuration=CredentialConfiguration(
            api_token="YOUR_TOKEN"
        )
    )
)
```

**With Client Credentials (OAuth2):**

```python
configuration = ClientConfiguration(
    api_url="http://localhost:8080",
    credentials=Credentials(
        method='client_credentials',
        configuration=CredentialConfiguration(
            api_issuer="YOUR_ISSUER",
            api_audience="YOUR_AUDIENCE",
            client_id="YOUR_CLIENT_ID",
            client_secret="YOUR_CLIENT_SECRET"
        )
    )
)
```

### Load Authorization Model from File

**From JSON file:**

```python
import json
from openfga_sdk import WriteAuthorizationModelRequest

# Read JSON file
with open('model.json', 'r') as f:
    model_json = json.load(f)

# Create request from JSON
body = WriteAuthorizationModelRequest(
    schema_version=model_json.get('schema_version', '1.1'),
    type_definitions=model_json['type_definitions'],
    conditions=model_json.get('conditions')
)

response = await fga_client.write_authorization_model(body)
# response.authorization_model_id contains the new model ID
```

**From DSL (.fga) file:**

The Python SDK does not include a built-in DSL parser. Convert DSL files to JSON using the OpenFGA CLI, then load the JSON file.

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```python
from openfga_sdk.client.models import ClientCheckRequest

body = ClientCheckRequest(
    user="user:anne",
    relation="viewer",
    object="document:roadmap",
)

response = await fga_client.check(body)
# response.allowed = True/False
```

### Batch Check

```python
from openfga_sdk.client.models import (
    ClientBatchCheckItem,
    ClientBatchCheckRequest
)

checks = [
    ClientBatchCheckItem(
        user="user:anne",
        relation="viewer",
        object="document:roadmap"
    ),
    ClientBatchCheckItem(
        user="user:bob",
        relation="editor",
        object="document:budget"
    )
]

response = await fga_client.batch_check(
    ClientBatchCheckRequest(checks=checks)
)
```

### Write Tuples

```python
from openfga_sdk.client.models import ClientTuple, ClientWriteRequest

body = ClientWriteRequest(
    writes=[
        ClientTuple(
            user="user:anne",
            relation="viewer",
            object="document:roadmap"
        )
    ],
    deletes=[
        ClientTuple(
            user="user:bob",
            relation="editor",
            object="document:budget"
        )
    ]
)

response = await fga_client.write(body)
```

### List Objects

```python
from openfga_sdk.client.models import ClientListObjectsRequest

body = ClientListObjectsRequest(
    user="user:anne",
    relation="viewer",
    type="document"
)

response = await fga_client.list_objects(body)
# response.objects = ["document:roadmap", "document:budget"]
```

### Stream List Objects

```python
request = ClientListObjectsRequest(
    user="user:anne",
    relation="viewer",
    type="document"
)

results = []
async for response in fga_client.streamed_list_objects(request):
    results.append(response.object)
```

### List Relations

```python
from openfga_sdk.client.models import ClientListRelationsRequest

body = ClientListRelationsRequest(
    user="user:anne",
    object="document:roadmap",
    relations=["can_view", "can_edit"]
)

response = await fga_client.list_relations(body)
# response.relations = ["can_view"]
```

### List Users

```python
from openfga_sdk.client.models import ClientListUsersRequest, UserTypeFilter
from openfga_sdk.models.fga_object import FgaObject

request = ClientListUsersRequest(
    object=FgaObject(type="document", id="roadmap"),
    relation="can_read",
    user_filters=[
        UserTypeFilter(type="user"),
        UserTypeFilter(type="team", relation="member")
    ]
)

response = await fga_client.list_users(request)
```

### Read Tuples

```python
from openfga_sdk import ReadRequestTupleKey

body = ReadRequestTupleKey(
    user="user:anne",
    relation="viewer",
    object="document:roadmap"
)

response = await fga_client.read(body)
# response.tuples = [Tuple(...), ...]
```

### Non-Transaction Write Mode

```python
from openfga_sdk.client.models import WriteTransactionOpts

options = {
    "transaction": WriteTransactionOpts(
        disabled=True,
        max_parallel_requests=10,
        max_per_chunk=100
    )
}

response = await fga_client.write(body, options)
```

### Handle Write Conflicts

```python
from openfga_sdk.client.models.write_conflict_opts import (
    ConflictOptions,
    ClientWriteRequestOnDuplicateWrites,
    ClientWriteRequestOnMissingDeletes
)

options = {
    "conflict": ConflictOptions(
        on_duplicate_writes=ClientWriteRequestOnDuplicateWrites.IGNORE,
        on_missing_deletes=ClientWriteRequestOnMissingDeletes.IGNORE
    )
}

response = await fga_client.write(body, options)
```

### Retry Configuration

```python
from openfga_sdk.configuration import RetryParams

config = ClientConfiguration(
    api_url="http://localhost:8080",
    retry_params=RetryParams(
        max_retry=5,
        min_wait_in_ms=250
    )
)
```

### Error Handling

```python
from openfga_sdk.exceptions import ApiException

try:
    await fga_client.check(request)
except ApiException as e:
    if e.is_validation_error():
        print(f"Validation error: {e.error_message}")
    elif e.is_retryable():
        print(f"Temporary error (Request: {e.request_id})")
    else:
        print(f"Error: {e}")
```

### Best Practices

- **Use async:** Prefer async client for better performance
- **Context manager:** Use `async with` or `with` for proper resource cleanup
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Streaming:** Use `streamed_list_objects` for large result sets
