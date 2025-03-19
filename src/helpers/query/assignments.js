import { toValue, toRaw } from 'vue';
import _find from 'lodash/find';
import _flatten from 'lodash/flatten';
import _get from 'lodash/get';
import _groupBy from 'lodash/groupBy';
import _mapValues from 'lodash/mapValues';
import _uniq from 'lodash/uniq';
import _without from 'lodash/without';
import _isEmpty from 'lodash/isEmpty';
import { convertValues, getAxiosInstance, mapFields } from './utils';
import { pluralizeFirestoreCollection } from '@/helpers';

const userSelectFields = ['name', 'assessmentPid', 'username', 'studentData', 'schools', 'classes'];

const assignmentSelectFields = [
  'assessments',
  'assigningOrgs',
  'completed',
  'dateAssigned',
  'dateClosed',
  'dateOpened',
  'id',
  'legal',
  'name',
  'publicName',
  'readOrgs',
  'sequential',
  'started',
];

export const getAssignmentsRequestBody = ({
  adminId,
  orgType,
  orgId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = assignmentSelectFields,
  orderBy = [],
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
        ],
      },
    };

    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: { fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}` },
        op: 'ARRAY_CONTAINS',
        value: { stringValue: orgId },
      },
    });
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

  if (!_isEmpty(orderBy)) {
    requestBody.structuredQuery.orderBy = orderBy;
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

export const assignmentCounter = (adminId, orgType, orgId, orderBy = []) => {
  const adminAxiosInstance = getAxiosInstance();
  const requestBody = getAssignmentsRequestBody({
    adminId: adminId,
    orgType,
    orgId,
    aggregationQuery: true,
    orderBy: toRaw(orderBy),
  });
  return adminAxiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
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
  orderBy = [],
) => {
  const adminAxiosInstance = getAxiosInstance();
  const appAxiosInstance = getAxiosInstance('app');

  const requestBody = getAssignmentsRequestBody({
    adminId: adminId,
    orgType,
    orgId,
    aggregationQuery: false,
    pageLimit: pageLimit.value,
    page: page.value,
    paginate: paginate,
    select: select,
    orderBy: toRaw(orderBy),
  });
  console.log(`Fetching page ${page.value} for ${adminId}`);
  return adminAxiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
    const assignmentData = mapFields(data, true);

    // Get User docs
    const userDocPaths = _uniq(
      _without(
        data.map((adminDoc) => {
          if (adminDoc.document?.name) {
            return adminDoc.document.name.split('/assignments/')[0];
          } else {
            return undefined;
          }
        }),
        undefined,
      ),
    );

    // Use batchGet to get all user docs with one post request
    const batchUserDocs = await adminAxiosInstance
      .post(':batchGet', {
        documents: userDocPaths,
        mask: { fieldPaths: userSelectFields },
      })
      .then(({ data }) => {
        return _without(
          data.map(({ found }) => {
            if (found) {
              const userId = found.name.split('/users/')[1];
              return {
                name: found.name,
                data: {
                  ..._mapValues(found.fields, (value) => convertValues(value)),
                  userId,
                },
              };
            }
            return undefined;
          }),
          undefined,
        );
      });

    // But the order of batchGet is not guaranteed, so we need to match the user
    // docs back with their assignments.
    const scoresObj = assignmentData.map((assignment) => {
      const user = batchUserDocs.find((userDoc) => userDoc.name.includes(assignment.parentDoc));
      return {
        assignment,
        user: user.data,
        roarUid: user.name.split('/users/')[1],
      };
    });

    if (includeScores) {
      // Use batchGet to get all of the run docs (including their scores)
      const runDocPaths = _flatten(
        assignmentData.map((assignment) => {
          const firestoreBasePath = 'https://firestore.googleapis.com/v1/';
          const adminBasePath = adminAxiosInstance.defaults.baseURL.replace(firestoreBasePath, '');
          const appBasePath = appAxiosInstance.defaults.baseURL.replace(firestoreBasePath, '');
          const runIds = _without(
            assignment.assessments.map((assessment) => assessment.runId),
            undefined,
          );
          const userPath = userDocPaths.find((userDocPath) => userDocPath.includes(assignment.parentDoc));
          return runIds.map((runId) => `${userPath.replace(adminBasePath, appBasePath)}/runs/${runId}`);
        }),
      );

      const batchRunDocs = await appAxiosInstance
        .post(':batchGet', {
          documents: runDocPaths,
          mask: { fieldPaths: ['scores', 'reliable', 'engagementFlags'] },
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

      for (const score of scoresObj) {
        const userRuns = runs[score.roarUid];
        for (const task of score.assignment.assessments) {
          const runId = task.runId;
          task['scores'] = _get(
            _find(userRuns, (runDoc) => runDoc.name.includes(runId)),
            'data.scores',
          );
          task['reliable'] = _get(
            _find(userRuns, (runDoc) => runDoc.name.includes(runId)),
            'data.reliable',
          );
          task['engagementFlags'] = _get(
            _find(userRuns, (runDoc) => runDoc.name.includes(runId)),
            'data.engagementFlags',
          );
        }
      }
    }

    return scoresObj;
  });
};

/**
 * Fetches the assignments that are currently open for a user.
 *
 * @param {ref<String>} roarUid - A Vue ref containing the user's ROAR ID.
 * @returns {Promise<Array>} - A promise that resolves to an array of open assignments for the user.
 */
export const getUserAssignments = async (roarUid) => {
  const adminAxiosInstance = getAxiosInstance();
  const assignmentRequest = getAssignmentsRequestBody({
    aggregationQuery: false,
    paginate: false,
    isCollectionGroupQuery: false,
  });
  const userId = toValue(roarUid);
  return await adminAxiosInstance
    .post(`/users/${toValue(userId)}:runQuery`, assignmentRequest)
    .then(async ({ data }) => {
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
