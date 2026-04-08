import { initContract } from '@ts-rest/core';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { TaskBundleListQuerySchema, TaskBundlesListResponseSchema } from './schema';

const c = initContract();

/**
 * Contract for the /task-bundles endpoints.
 * Super-admin-only access to paginated task bundles with their associated task variants.
 */
export const TaskBundlesContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: TaskBundleListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(TaskBundlesListResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List task bundles',
      description:
        'Returns a paginated list of task bundles. Requires super admin privileges. ' +
        'Each bundle includes a summary list of its task variants ordered by sortOrder. ' +
        'Supports pagination (page, perPage), free-text search across bundle name/description, ' +
        'task slug, and variant name; sorting by name (default, asc), slug, createdAt, or updatedAt; ' +
        'structured filter expressions (?filter=taskBundle.slug:eq:some-slug); ' +
        'and optional embed of full task variant details (?embed=taskVariantDetails). ' +
        'Returns 400 if query parameters are invalid. ' +
        'Returns 403 if the caller is not a super admin. ' +
        'Returns 500 if a server error occurs.',
    },
  },
  { pathPrefix: '/task-bundles' },
);
