import { StatusCodes } from 'http-status-codes';
import { createApiClient } from './receiver/roar-api';
import type { ApiClientConfig } from './receiver/roar-api';
import { SDKError } from './errors/sdk-error';
import { SdkErrorCode } from './enums/sdk-error-code.enum';

/**
 * Configuration for {@link bootstrapAnonymousSession}.
 *
 * This is the participant-free subset of CommandContext — it intentionally omits
 * `participant`, because bootstrap is the step that *provisions* the participantId.
 * `auth.getToken()` must return a Firebase **anonymous** ID token: the underlying
 * `POST /users/anonymous` endpoint rejects non-anonymous tokens.
 */
export type BootstrapContext = ApiClientConfig;

/**
 * Optional task/variant resolution for {@link bootstrapAnonymousSession}.
 *
 * @property variantId - If provided, this variant is returned as-is without a lookup.
 * @property taskId - If provided (and `variantId` is not), bootstrap resolves the first
 *                    published variant for this task. Mirrors the historical serve.js fallback.
 */
export interface BootstrapAnonymousSessionInput {
  variantId?: string;
  taskId?: string;
}

/**
 * Result of {@link bootstrapAnonymousSession}.
 *
 * @property participantId - The provisioned ROAR user UUID, suitable for `participant.participantId`.
 * @property variantId - The resolved task variant id, present only when `variantId` or `taskId` was supplied.
 */
export interface BootstrapAnonymousSessionResult {
  participantId: string;
  variantId?: string;
}

/**
 * Bootstraps an anonymous assessment session.
 *
 * Solves the chicken-and-egg problem where {@link initAssessmentSdk} (and the Firekit compat
 * facade) require a `participantId`, yet the only way to obtain that id for a guest player is
 * to call `POST /users/anonymous` — a call that, by definition, cannot be made with a
 * participantId. Standalone assessments previously worked around this with a raw `fetch` in
 * `serve.js`; this method replaces that antipattern with a typed, contract-aware SDK call.
 *
 * Steps:
 * 1. Provision (or retrieve) the anonymous ROAR user via `POST /users/anonymous`, yielding the participantId.
 * 2. Optionally resolve a task variant — uses `variantId` directly if given, otherwise falls back
 *    to the first published variant for `taskId`.
 *
 * **Ordering is significant.** The variant lookup (`GET /tasks/:taskId/variants`) runs behind the
 * standard auth guard, which requires the caller's ROAR user record to already exist in the
 * database. Step 1 creates that record, so it must precede step 2. Do not reorder these calls.
 *
 * The endpoints are idempotent: repeated calls for the same Firebase UID return the same
 * participantId, so retrying a failed bootstrap is safe.
 *
 * @param ctx - baseUrl + auth callbacks (anonymous Firebase token), optional requestId/fetch/logger
 * @param input - Optional variant resolution (variantId or taskId)
 * @returns The provisioned participantId and, when requested, the resolved variantId
 * @throws {SDKError} With code `BOOTSTRAP_FAILED` if provisioning or variant resolution fails
 *
 * @example
 * ```ts
 * const { participantId, variantId } = await bootstrapAnonymousSession(
 *   { baseUrl: ROAR_API_BASE_URL, auth: { getToken: () => user.getIdToken() } },
 *   { taskId: pa.PA_TASK_ID },
 * );
 *
 * initFirekitCompat(
 *   { baseUrl: ROAR_API_BASE_URL, auth: { getToken: () => user.getIdToken() }, participant: { participantId } },
 *   { variantId, taskVersion, isAnonymous: true },
 * );
 * ```
 */
export async function bootstrapAnonymousSession(
  ctx: BootstrapContext,
  input: BootstrapAnonymousSessionInput = {},
): Promise<BootstrapAnonymousSessionResult> {
  const client = createApiClient(ctx);

  // Step 1: provision the anonymous ROAR user. This must happen before any variant
  // lookup, since the variant endpoint requires the user record to already exist.
  const created = await client.users.createAnonymous();
  if (created.status !== StatusCodes.OK) {
    const errorBody = created.body as { error?: { message?: string } };
    throw new SDKError(
      errorBody.error?.message ?? `Failed to provision anonymous user with status ${created.status}`,
      { code: SdkErrorCode.BOOTSTRAP_FAILED },
    );
  }

  const participantId = created.body.data.id;

  // Step 2 (optional): resolve a task variant. An explicit variantId wins; otherwise fall
  // back to the first published variant for the task.
  // TODO: Replace the first-published fallback with a proper "default variant" concept once
  // the task_variants schema supports marking a single variant as default per task.
  // See: https://github.com/yeatmanlab/roar-project-management/issues/1828
  let resolvedVariantId = input.variantId;
  if (!resolvedVariantId && input.taskId) {
    const variants = await client.tasks.listTaskVariants({
      params: { taskId: input.taskId },
      query: { perPage: 1 },
    });

    if (variants.status !== StatusCodes.OK) {
      const errorBody = variants.body as { error?: { message?: string } };
      throw new SDKError(
        errorBody.error?.message ?? `Failed to resolve task variant with status ${variants.status}`,
        { code: SdkErrorCode.BOOTSTRAP_FAILED },
      );
    }

    resolvedVariantId = variants.body.data.items[0]?.id;
    if (!resolvedVariantId) {
      throw new SDKError(`No published variant found for task ${input.taskId}`, {
        code: SdkErrorCode.BOOTSTRAP_FAILED,
      });
    }
  }

  return {
    participantId,
    ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
  };
}
