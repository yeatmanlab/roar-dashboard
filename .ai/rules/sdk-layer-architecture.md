## Assessment SDK layer architecture

The assessment SDK (`packages/assessment-sdk/`) follows the GoF Command pattern with three layers: Receiver, Command, and Compat. Each layer has a strict responsibility boundary. The SDK is auth-provider-agnostic — it receives authentication callbacks, never loads Firebase or any auth library itself.

### The 3 layers

| # | Layer | Location | Responsibility |
|---|-------|----------|----------------|
| 1 | Receiver | `src/receiver/roar-api.ts` | Expose a typed ts-rest client with cross-cutting concerns (auth headers, tracing). **No endpoint-specific methods.** |
| 2 | Command | `src/commands/<name>.command.ts` | Request construction, response interpretation, domain errors. Calls `api.client.<resource>.<method>(...)`. |
| 3 | Compat | `src/compat/firekit.ts` | Legacy Firekit-compatible standalone functions. Internally creates commands and runs them via the Invoker. |

### Receiver — thin ts-rest client wrapper

The Receiver's only job is to initialize a typed ts-rest client from `@roar-dashboard/api-contract` and inject cross-cutting concerns (auth headers, request tracing). It must not contain endpoint-specific methods like `createRun()` or `writeTrial()`.

#### Incorrect

```typescript
// Receiver with endpoint-specific methods — violates layer boundary
export class RoarApi {
  constructor(private ctx: CommandContext) {}

  async createRun(input: StartRunInput): Promise<StartRunOutput> {
    const res = await fetch(`${this.ctx.baseUrl}/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskVariantId: input.variantId, /* ... */ }),
    });
    const data = await res.json();
    return { runId: (data as { id: string }).id }; // unsafe cast, wrong envelope
  }
}
```

Problems with this approach:

- **Manual paths** — endpoint URLs are hardcoded instead of derived from the contract
- **Manual serialization** — `JSON.stringify` and manual header management instead of ts-rest handling it
- **Unsafe response parsing** — `as { id: string }` cast on the response, missing the `SuccessEnvelopeSchema` wrapper (`{ data: { id } }`)
- **No type safety** — response shape mismatches (e.g., expecting `{ id }` when the contract returns `{ data: { id } }`) are only caught at runtime
- **Doesn't scale** — every new endpoint requires a new method on the Receiver

#### Correct

```typescript
import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-dashboard/api-contract';
import type { CommandContext } from '../command/command';

export class RoarApi {
  public readonly client: ReturnType<typeof initClient<typeof ApiContractV1>>;

  constructor(private ctx: CommandContext) {
    this.client = initClient(ApiContractV1, {
      baseUrl: ctx.baseUrl,
      baseHeaders: {},
      api: async (args) => {
        const token = await ctx.auth.getToken();
        args.headers = {
          ...args.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        return tsRestFetchApi(args);
      },
    });
  }
}
```

This gives us:

- **Contract-derived paths** — ts-rest generates endpoint URLs from the contract definition
- **Automatic serialization** — ts-rest handles JSON encoding/decoding and content-type headers
- **Fully typed responses** — `result.body.data.id` is typed from `SuccessEnvelopeSchema(CreateRunResponseSchema)`, no casts needed
- **Scales to every endpoint** — commands call `api.client.runs.create(...)`, `api.client.administrations.get(...)`, etc.

### Command — request construction and response interpretation

Commands own the domain logic of a single operation: constructing the request body, interpreting the typed response, and throwing `SDKError` on failure. They call the Receiver's typed ts-rest client, never raw `fetch()`.

#### Incorrect

```typescript
// Command as a passthrough — the Receiver is doing the real work
export class StartRunCommand implements Command<StartRunInput, StartRunOutput> {
  async execute(input: StartRunInput): Promise<StartRunOutput> {
    return this.api.createRun(input); // just delegates, no value added
  }
}
```

#### Correct

```typescript
import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { StartRunInput, StartRunOutput } from '../types/start-run';
import { SDKError } from '../errors/sdk-error';

export class StartRunCommand implements Command<StartRunInput, StartRunOutput> {
  readonly name = 'StartRun';
  readonly idempotent = false;

  constructor(private api: RoarApi) {}

  async execute(input: StartRunInput): Promise<StartRunOutput> {
    const result = await this.api.client.runs.create({
      body: {
        taskVariantId: input.variantId,
        taskVersion: input.taskVersion,
        administrationId: input.isAnonymous ? undefined : input.administrationId,
        isAnonymous: input.isAnonymous ?? false,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });

    if (result.status === StatusCodes.CREATED) {
      return { runId: result.body.data.id };
    }

    throw new SDKError(`Failed to start run with status ${result.status}`, {
      code: 'CREATE_RUN_FAILED',
    });
  }
}
```

Every future command follows the same shape: call the typed contract endpoint, interpret the response, throw `SDKError` on failure.

### Compat — legacy Firekit bridge

The compat layer exposes standalone functions (`startRun`, `writeTrial`, `finishRun`, `abortRun`) that match the legacy Firekit API. Internally, each function creates the appropriate command and runs it via the Invoker. Assessments import these directly — no invoker, no commands, no API client visible:

```typescript
import { startRun, writeTrial, finishRun, abortRun } from '@roar-dashboard/assessment-sdk/compat/firekit';

await startRun({ sessionId: 'abc' });
await writeTrial({ correct: 1, rt: 450, stimulus: 'cat' });
await finishRun();
```

`initFirekitCompat` accepts task info as a second argument — there should be no separate `_setTaskInfoForCompat` export:

```typescript
export function initFirekitCompat(
  ctx: CommandContext,
  taskInfo: { variantId: string; version: string; administrationId?: string; isAnonymous?: boolean },
): FirekitFacade {
  const facade = FirekitFacade.getInstance();
  facade.initialize(ctx, taskInfo);
  return facade;
}
```

### Auth-provider-agnostic design

The SDK never loads Firebase or any auth library. It receives `getToken()` and `refreshToken()` callbacks via `CommandContext`. The host application (dashboard or standalone assessment) is responsible for authentication:

- **Dashboard mode:** The dashboard already has a signed-in Firebase user. It passes auth callbacks and the ROAR user `participantId` into the assessment, which passes them to the SDK.
- **Standalone mode:** The assessment loads Firebase Auth itself, does an anonymous sign-in, resolves the ROAR user ID (e.g., via `GET /me`), and provides everything to the SDK.

```typescript
export interface CommandContext {
  environment: Environment;
  participantId: string;
  auth: {
    getToken(): Promise<string | undefined>;
    refreshToken?(): Promise<string | undefined>;
  };
  logger?: Logger;
}
```

### Error handling

Commands throw `SDKError` for all failure cases. Never throw raw `Error`:

```typescript
// Incorrect — raw Error
throw new Error(`createRun failed (${res.status}): ${text}`);

// Correct — SDKError with structured code
throw new SDKError(`Failed to start run with status ${result.status}`, {
  code: 'CREATE_RUN_FAILED',
});
```

### The principle

The Receiver is a thin infrastructure layer — it knows how to talk to the API but not what to say. Commands are the domain layer — they know what to say but not how to send it. This separation means the Receiver never changes when new endpoints are added (commands just call `api.client.<resource>.<method>`), and commands never change when infrastructure concerns evolve (auth strategy, retry logic, tracing). The ts-rest client is the critical link: it ensures that request/response shapes match the contract at compile time, eliminating an entire class of runtime bugs.
