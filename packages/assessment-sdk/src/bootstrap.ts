import { StatusCodes } from 'http-status-codes';
import type { ApiError } from '@roar-platform/api-contract';
import { createApiClient } from './receiver/roar-api';
import type { ApiClientConfig } from './receiver/roar-api';
import { SDKError } from './errors/sdk-error';
import { SdkErrorCode } from './enums/sdk-error-code.enum';
import type { Logger } from './command/command';

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
 * How to behave when `defaultVariantName` is supplied but matches no published variant.
 *
 * - `THROW` — fail immediately (staging and production). A typo or a renamed variant should
 *   surface at once rather than silently running a different configuration.
 * - `FALLBACK` — warn and fall back to the oldest published variant (local dev). A
 *   researcher's own seed need not contain the canonical variant for the assessment to run.
 *
 * Exported as values so callers select a behaviour by constant rather than by string
 * literal — the SDK defines the union, so it owns the vocabulary.
 */
export const UnresolvedDefault = {
  THROW: 'throw',
  FALLBACK: 'fallback',
} as const;

export type UnresolvedDefaultBehaviour = (typeof UnresolvedDefault)[keyof typeof UnresolvedDefault];

/**
 * Optional task/variant resolution for {@link bootstrapAnonymousSession}.
 *
 * @property variantId - If provided, this variant is returned as-is without a lookup.
 * @property taskId - If provided (and `variantId` is not), bootstrap resolves a published
 *                    variant for this task — see `defaultVariantName`.
 * @property defaultVariantName - Preferred variant, matched case-insensitively against the
 *                    task's published variant names. `task_variants` is uniquely indexed on
 *                    `(taskId, lower(name))`, so a name identifies at most one variant per
 *                    task. When omitted, resolution falls back to the oldest published variant.
 * @property onUnresolvedDefault - What to do when `defaultVariantName` matches nothing.
 *                    Defaults to `throw`. Callers pass this in rather than the SDK inferring
 *                    it: strictness is an environment policy, and the SDK is deliberately
 *                    host-agnostic (it must not read build globals such as `ROAR_DB`).
 */
export interface BootstrapAnonymousSessionInput {
  variantId?: string;
  taskId?: string;
  defaultVariantName?: string;
  onUnresolvedDefault?: UnresolvedDefaultBehaviour;
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
 * Page size for the published-variant lookup.
 *
 * The name match needs the whole published set, not one row, so this is the contract's
 * `perPage` maximum. The largest assessment currently declares eleven variants for a task,
 * so a single page covers every real case.
 */
const PUBLISHED_VARIANT_LOOKUP_PER_PAGE = 100;

/** A published variant as returned by `GET /tasks/:taskId/variants`. */
interface PublishedVariant {
  id: string;
  name: string | null;
}

/**
 * Pick which published variant a session should run.
 *
 * Resolution order:
 * 1. `defaultVariantName`, matched case-insensitively — the caller's declared choice.
 * 2. If that name matches nothing: throw, or warn and continue, per `onUnresolvedDefault`.
 * 3. Oldest published variant, which is the behaviour that predates named defaults.
 *
 * A warning is also emitted when no name was declared and the task has more than one
 * published variant, since the choice is then made by seeding order rather than intent.
 *
 * @param published - The task's published variants, oldest first
 * @param input - The caller's resolution input
 * @param logger - Optional logger from the bootstrap context; falls back to `console`
 * @returns The id of the variant to run
 * @throws {SDKError} BOOTSTRAP_FAILED if a declared name is unresolved under `throw`, or if
 *   the task has no published variants at all
 */
function selectVariantId(
  published: PublishedVariant[],
  input: BootstrapAnonymousSessionInput,
  logger: Logger | undefined,
): string {
  const { taskId, defaultVariantName, onUnresolvedDefault = UnresolvedDefault.THROW } = input;
  const warn = logger?.warn.bind(logger) ?? console.warn;

  if (defaultVariantName) {
    const wanted = defaultVariantName.toLowerCase();
    const match = published.find((variant) => variant.name?.toLowerCase() === wanted);
    if (match) return match.id;

    // Listing the real names is what makes this self-service: the caller sees what they
    // could have meant instead of guessing at a rename or a typo.
    const available = published.map((variant) => variant.name).filter(Boolean);
    const availableList = available.length > 0 ? available.join(', ') : '(none published)';

    if (onUnresolvedDefault === UnresolvedDefault.THROW) {
      throw new SDKError(
        `Default variant "${defaultVariantName}" not found for task ${taskId}. Published variants: ${availableList}`,
        { code: SdkErrorCode.BOOTSTRAP_FAILED },
      );
    }

    warn(
      `[assessment-sdk] Default variant "${defaultVariantName}" not found for task ${taskId}; ` +
        `falling back to the oldest published variant. Published variants: ${availableList}`,
    );
  } else if (published.length > 1) {
    warn(
      `[assessment-sdk] No default variant declared for task ${taskId} and ${published.length} are ` +
        `published; falling back to the oldest. Declare one in the assessment's serve.js to make this explicit.`,
    );
  }

  const oldest = published[0]?.id;
  if (!oldest) {
    throw new SDKError(`No published variant found for task ${taskId}`, {
      code: SdkErrorCode.BOOTSTRAP_FAILED,
    });
  }
  return oldest;
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
 * 2. Optionally resolve a task variant — uses `variantId` directly if given, otherwise matches
 *    `defaultVariantName` against the task's published variants, falling back to the oldest.
 *
 * **Ordering is significant.** The variant lookup (`GET /tasks/:taskId/variants`) runs behind the
 * standard auth guard, which requires the caller's ROAR user record to already exist in the
 * database. Step 1 creates that record, so it must precede step 2. Do not reorder these calls.
 *
 * The endpoints are idempotent: repeated calls for the same Firebase UID return the same
 * participantId, so retrying a failed bootstrap is safe.
 *
 * @param ctx - baseUrl + auth callbacks (anonymous Firebase token), optional requestId/fetch/logger
 * @param input - Optional variant resolution (variantId, or taskId plus an optional
 *                declared default — see {@link BootstrapAnonymousSessionInput})
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
    const errorBody = created.body as ApiError;
    throw new SDKError(errorBody.error.message ?? `Failed to provision anonymous user with status ${created.status}`, {
      code: SdkErrorCode.BOOTSTRAP_FAILED,
    });
  }

  const participantId = created.body.data.id;

  // Step 2 (optional): resolve a task variant. An explicit variantId wins; otherwise the
  // caller's declared default is matched by name, with the oldest published variant as the
  // last resort.
  let resolvedVariantId = input.variantId;
  if (!resolvedVariantId && input.taskId) {
    // Sorted oldest-first so items[0] remains the historical fallback. perPage covers every
    // published variant a task realistically has, so the name match sees the full set.
    const variants = await client.tasks.listTaskVariants({
      params: { taskId: input.taskId },
      query: {
        perPage: PUBLISHED_VARIANT_LOOKUP_PER_PAGE,
        sortBy: 'createdAt',
        sortOrder: 'asc',
        status: 'published',
      },
    });

    if (variants.status !== StatusCodes.OK) {
      const errorBody = variants.body as ApiError;
      throw new SDKError(errorBody.error.message ?? `Failed to resolve task variant with status ${variants.status}`, {
        code: SdkErrorCode.BOOTSTRAP_FAILED,
      });
    }

    resolvedVariantId = selectVariantId(variants.body.data.items, input, ctx.logger);
  }

  return {
    participantId,
    ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
  };
}
