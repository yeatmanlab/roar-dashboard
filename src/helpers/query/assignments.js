import _find from 'lodash/find';
import _flatten from 'lodash/flatten';
import _get from 'lodash/get';
import _groupBy from 'lodash/groupBy';
import _mapValues from 'lodash/mapValues';
import _without from 'lodash/without';
import _zip from 'lodash/zip';
import { convertValues, getAxiosInstance, mapFields } from './utils';
import { pluralizeFirestoreCollection } from '@/helpers';

export const getAssignmentsRequestBody = ({
  adminId,
  orgType,
  orgId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = [
    'assessments',
    'assigningOrgs',
    'readOrgs',
    'completed',
    'dateAssigned',
    'dateClosed',
    'dateOpened',
    'started',
    'id',
  ],
  isCollectionGroupQuery = true,
}) => {
  const requestBody = {
    structuredQuery: {},
  };

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    if (select.length > 0) {
      requestBody.structuredQuery.select = {
        fields: select.map((field) => ({ fieldPath: field })),
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: 'assignments',
      allDescendants: isCollectionGroupQuery,
    },
  ];

  if (adminId && orgId) {
    requestBody.structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'id' },
              op: 'EQUAL',
              value: { stringValue: adminId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}` },
              op: 'ARRAY_CONTAINS',
              value: { stringValue: orgId },
            },
          },
        ],
      },
    };
  } else {
    const currentDate = new Date().toISOString();
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'dateClosed' },
        op: 'GREATER_THAN_OR_EQUAL',
        value: { timestampValue: currentDate },
      },
    };
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

export const getScoresRequestBody = ({
  runIds,
  orgType,
  orgId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = ['scores'],
}) => {
  const requestBody = {
    structuredQuery: {},
  };

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    requestBody.structuredQuery.select = {
      fields: select.map((field) => ({ fieldPath: field })),
    };
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: 'runs',
      allDescendants: true,
    },
  ];

  requestBody.structuredQuery.where = {
    compositeFilter: {
      op: 'AND',
      filters: [
        {
          fieldFilter: {
            field: { fieldPath: 'id' },
            op: 'IN',
            value: {
              arrayValue: {
                values: [
                  runIds.map((runId) => {
                    return { stringValue: runId };
                  }),
                ],
              },
            },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}` },
            op: 'ARRAY_CONTAINS',
            value: { stringValue: orgId },
          },
        },
      ],
    },
  };

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

export const assignmentCounter = (adminId, orgType, orgId) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getAssignmentsRequestBody({
    adminId: adminId,
    orgType: orgType,
    orgId: orgId,
    aggregationQuery: true,
  });
  return axiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
    return Number(convertValues(data[0].result?.aggregateFields?.count));
  });
};

export const assignmentPageFetcher = async (
  adminId,
  orgType,
  orgId,
  pageLimit,
  page,
  includeScores = false,
  select = undefined,
  paginate = true,
) => {
  const adminAxiosInstance = getAxiosInstance();
  const appAxiosInstance = getAxiosInstance('app');
  const requestBody = getAssignmentsRequestBody({
    adminId: adminId,
    orgType: orgType,
    orgId: orgId,
    aggregationQuery: false,
    pageLimit: pageLimit.value,
    page: page.value,
    paginate: paginate,
    select: select,
  });
  console.log(`Fetching page ${page.value} for ${adminId}`);
  return adminAxiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
    const assignmentData = mapFields(data);
    // Get User docs
    const userDocPaths = _without(
      data.map((adminDoc) => {
        if (adminDoc.document?.name) {
          return adminDoc.document.name.split('/assignments/')[0];
        } else {
          return undefined;
        }
      }),
      undefined,
    );

    // Use batchGet to get all user docs with one post request
    const batchUserDocs = await adminAxiosInstance
      .post(':batchGet', {
        documents: userDocPaths,
      })
      .then(({ data }) => {
        return _without(
          data.map(({ found }) => {
            if (found) {
              return {
                name: found.name,
                data: _mapValues(found.fields, (value) => convertValues(value)),
              };
            }
            return undefined;
          }),
          undefined,
        );
      });

    // But the order of batchGet is not guaranteed, so we need to order the docs
    // by the order of userDocPaths
    const userDocData = batchUserDocs
      .sort((a, b) => {
        return userDocPaths.indexOf(a.name) - userDocPaths.indexOf(b.name);
      })
      .map(({ data }) => data);

    const scoresObj = _zip(userDocData, assignmentData).map(([userData, assignmentData]) => ({
      assignment: assignmentData,
      user: userData,
    }));

    if (includeScores) {
      // Use batchGet to get all of the run docs (including their scores)
      const runDocPaths = _flatten(
        _zip(userDocPaths, assignmentData).map(([userPath, assignment]) => {
          const firestoreBasePath = 'https://firestore.googleapis.com/v1/';
          const adminBasePath = adminAxiosInstance.defaults.baseURL.replace(firestoreBasePath, '');
          const appBasePath = appAxiosInstance.defaults.baseURL.replace(firestoreBasePath, '');
          const runIds = _without(
            assignment.assessments.map((assessment) => assessment.runId),
            undefined,
          );
          return runIds.map((runId) => `${userPath.replace(adminBasePath, appBasePath)}/runs/${runId}`);
        }),
      );

      const batchRunDocs = await appAxiosInstance
        .post(':batchGet', {
          documents: runDocPaths,
          mask: { fieldPaths: ['scores'] },
        })
        .then(({ data }) => {
          return _without(
            data.map(({ found }) => {
              if (found) {
                return {
                  name: found.name,
                  data: _mapValues(found.fields, (value) => convertValues(value)),
                };
              }
              return undefined;
            }),
            undefined,
          );
        });

      // Again the order of batchGet is not guaranteed. This time, we'd like to
      // group the runDocs by user's roarUid, in the same order as the userDocPaths
      const runs = _groupBy(batchRunDocs, (runDoc) => runDoc.name.split('/users/')[1].split('/runs/')[0]);

      for (const [index, userPath] of userDocPaths.entries()) {
        const roarUid = userPath.split('/users/')[1];
        const userRuns = runs[roarUid];
        for (const task of scoresObj[index].assignment.assessments) {
          const runId = task.runId;
          task['scores'] = _get(
            _find(userRuns, (runDoc) => runDoc.name.includes(runId)),
            'data.scores',
          );
        }
      }
    }

    return scoresObj;
  });
};

export const getUserAssignments = async (roarUid) => {
  const adminAxiosInstance = getAxiosInstance();
  const assignmentRequest = getAssignmentsRequestBody({
    aggregationQuery: false,
    paginate: false,
    isCollectionGroupQuery: false,
  });
  return await adminAxiosInstance.post(`/users/${roarUid}:runQuery`, assignmentRequest).then(async ({ data }) => {
    const assignmentData = mapFields(data);
    const openAssignments = assignmentData.filter((assignment) => new Date(assignment.dateOpened) <= new Date());
    return openAssignments;
  });
};

export const assignmentFetchAll = async (adminId, orgType, orgId, includeScores = false) => {
  return await assignmentPageFetcher(
    adminId,
    orgType,
    orgId,
    { value: 2 ** 31 - 1 },
    { value: 0 },
    includeScores,
    true,
    true,
  );
};
