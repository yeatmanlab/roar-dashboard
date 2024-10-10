import { toValue } from 'vue';
import _pick from 'lodash/pick';
import _get from 'lodash/get';
import _mapValues from 'lodash/mapValues';
import _uniq from 'lodash/uniq';
import _without from 'lodash/without';
import { convertValues, getAxiosInstance, mapFields } from './utils';
import { pluralizeFirestoreCollection } from '@/helpers';

/**
 * Constructs the request body for fetching runs based on the provided parameters.
 *
 * @param {Object} params - The parameters for constructing the request body.
 * @param {string} params.administrationId - The administration ID.
 * @param {string} params.orgType - The type of the organization.
 * @param {string} params.orgId - The ID of the organization.
 * @param {string} [params.taskId] - The task ID.
 * @param {boolean} [params.aggregationQuery] - Whether to use aggregation query.
 * @param {number} [params.pageLimit] - The page limit for pagination.
 * @param {number} [params.page] - The page number for pagination.
 * @param {boolean} [params.paginate=true] - Whether to paginate the results.
 * @param {Array<string>} [params.select=['scores.computed.composite']] - The fields to select.
 * @param {boolean} [params.allDescendants=true] - Whether to include all descendants.
 * @param {boolean} [params.requireCompleted=false] - Whether to require completed runs.
 * @returns {Object} The constructed request body.
 */
export const getRunsRequestBody = ({
  administrationId,
  orgType,
  orgId,
  taskId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = ['scores.computed.composite'],
  allDescendants = true,
  requireCompleted = false,
}) => {
  const requestBody = {
    structuredQuery: {},
  };

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    if (select) {
      requestBody.structuredQuery.select = {
        fields: select.map((field) => ({ fieldPath: field })),
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: 'runs',
      allDescendants: allDescendants,
    },
  ];

  if (administrationId && (orgId || !allDescendants)) {
    requestBody.structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'assignmentId' },
              op: 'EQUAL',
              value: { stringValue: administrationId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'bestRun' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
        ],
      },
    };

    if (orgId) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}` },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: orgId },
        },
      });
    }
  } else {
    requestBody.structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'bestRun' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
        ],
      },
    };
  }

  if (taskId) {
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: { fieldPath: 'taskId' },
        op: 'EQUAL',
        value: { stringValue: taskId },
      },
    });
  }

  if (requireCompleted) {
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: { fieldPath: 'completed' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    });
  }

  if (aggregationQuery) {
    return {
      structuredAggregationQuery: {
        ...requestBody,
        aggregations: [
          {
            alias: 'count',
            count: {},
          },
        ],
      },
    };
  }

  return requestBody;
};

/**
 * Counts the number of runs for a given administration and organization.
 *
 * @param {string} administrationId - The administration ID.
 * @param {string} orgType - The type of the organization.
 * @param {string} orgId - The ID of the organization.
 * @returns {Promise<number>} The count of runs.
 */
export const runCounter = async (administrationId, orgType, orgId) => {
  const axiosInstance = getAxiosInstance('app');
  const requestBody = getRunsRequestBody({
    administrationId: toValue(administrationId),
    orgType: toValue(orgType),
    orgId: toValue(orgId),
    aggregationQuery: true,
  });
  return axiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
    return Number(convertValues(data[0].result?.aggregateFields?.count));
  });
};

/**
 * Fetches run page data for a given set of parameters.
 *
 * @param {Object} params - The parameters for fetching run page data.
 * @param {string} params.administrationId - The administration ID.
 * @param {string} [params.userId] - The user ID.
 * @param {string} params.orgType - The organization type.
 * @param {string} params.orgId - The organization ID.
 * @param {string} [params.taskId] - The task ID.
 * @param {number} [params.pageLimit] - The page limit for pagination.
 * @param {number} [params.page] - The page number for pagination.
 * @param {Array<string>} [params.select=['scores.computed.composite']] - The fields to select.
 * @param {string} [params.scoreKey='scores.computed.composite'] - The key for scores.
 * @param {boolean} [params.paginate=true] - Whether to paginate the results.
 * @returns {Promise<Array<Object>>} The fetched run page data.
 */
export const runPageFetcher = async ({
  administrationId,
  userId,
  orgType,
  orgId,
  taskId,
  pageLimit,
  page,
  select = ['scores.computed.composite'],
  scoreKey = 'scores.computed.composite',
  paginate = true,
}) => {
  const appAxiosInstance = getAxiosInstance('app');
  const requestBody = getRunsRequestBody({
    administrationId: toValue(administrationId),
    orgType: toValue(orgType),
    orgId: toValue(orgId),
    taskId: toValue(taskId),
    allDescendants: toValue(userId) === undefined,
    aggregationQuery: false,
    pageLimit: paginate ? toValue(pageLimit) : undefined,
    page: paginate ? toValue(page) : undefined,
    paginate: toValue(paginate),
    select: toValue(select),
  });
  const runQuery = toValue(userId) === undefined ? ':runQuery' : `/users/${toValue(userId)}:runQuery`;
  return appAxiosInstance.post(runQuery, requestBody).then(async ({ data }) => {
    const runData = mapFields(data, true);

    const userDocPaths = _uniq(
      _without(
        data.map((runDoc) => {
          if (runDoc.document?.name) {
            return runDoc.document.name.split('/runs/')[0];
          } else {
            return undefined;
          }
        }),
        undefined,
      ),
    );

    // Use batchGet to get all user docs with one post request
    const batchUserDocs = await appAxiosInstance
      .post(':batchGet', {
        documents: userDocPaths,
        mask: { fieldPaths: ['grade', 'birthMonth', 'birthYear', 'schools.current'] },
      })
      .then(({ data }) => {
        return _without(
          data.map(({ found }) => {
            if (found) {
              return {
                name: found.name,
                id: found.name.split('/users/')[1],
                data: _mapValues(found.fields, (value) => convertValues(value)),
              };
            }
            return undefined;
          }),
          undefined,
        );
      });

    const userDocDict = batchUserDocs.reduce((acc, user) => {
      acc[user.id] = { ...user };
      return acc;
    }, {});

    const otherKeys = _without(select, scoreKey);

    return runData.map((run) => {
      const user = userDocDict[run.parentDoc];
      return {
        scores: _get(run, scoreKey),
        taskId: run.taskId,
        user,
        ..._pick(run, otherKeys),
      };
    });
  });
};
