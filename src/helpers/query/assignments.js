import { toValue, toRaw } from 'vue';
import _find from 'lodash/find';
import _flatten from 'lodash/flatten';
import _get from 'lodash/get';
import _groupBy from 'lodash/groupBy';
import _mapValues from 'lodash/mapValues';
import _uniq from 'lodash/uniq';
import _pick from 'lodash/pick';
import _intersection from 'lodash/intersection';
import _without from 'lodash/without';
import _isEmpty from 'lodash/isEmpty';
import { convertValues, getAxiosInstance, mapFields } from './utils';
import { pluralizeFirestoreCollection } from '@/helpers';
import { ORG_TYPES, ORG_TYPES_IN_ORDER } from '@/constants/orgTypes';

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
  orgArray = [],
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = assignmentSelectFields,
  filter = {},
  orderBy = [],
  grades = [],
  isCollectionGroupQuery = true,
  restrictToOpenAssignments = false,
  excludeTestData = false,
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

  requestBody.structuredQuery.where = { compositeFilter: { op: 'AND', filters: [] } };
  if (adminId || orgId || orgArray) {
    if (adminId) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: 'id' },
          op: 'EQUAL',
          value: { stringValue: adminId },
        },
      });
    }

    if (orgType && !_isEmpty(orgArray)) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}` },
          op: 'ARRAY_CONTAINS_ANY',
          value: {
            arrayValue: {
              values: [
                orgArray.map((orgId) => {
                  return { stringValue: orgId };
                }),
              ],
            },
          },
        },
      });
    }
    if (orgType && orgId) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}` },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: orgId },
        },
      });
    }

    if (!_isEmpty(grades)) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: `userData.grade` },
          op: 'IN',
          value: {
            arrayValue: {
              values: [
                ...grades.map((grade) => {
                  return { stringValue: grade };
                }),
              ],
            },
          },
        },
      });
    }

    if (['Completed', 'Started', 'Assigned'].includes(filter?.value)) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: `progress.${filter.taskId.replace(/-/g, '_')}` },
          op: 'EQUAL',
          value: { stringValue: filter.value.toLowerCase() },
        },
      });
    } else if (!_isEmpty(filter)) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: `userData.${filter.field}` },
          op: 'EQUAL',
          value: { stringValue: filter.value },
        },
      });
    }
  }
  if (restrictToOpenAssignments) {
    const currentDate = new Date().toISOString();
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: { fieldPath: 'dateClosed' },
        op: 'GREATER_THAN_OR_EQUAL',
        value: { timestampValue: currentDate },
      },
    });
  }

  // N.B. The create administration form writes the testData key regardless of the value being set.
  // Therefore this value should be present in all assignment docs.
  if (excludeTestData) {
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: { fieldPath: 'testData' },
        op: 'EQUAL',
        value: { stringValue: 'false' },
      },
    });
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
export const getUserAssignments = async (roarUid, orgType = null, orgIds = null) => {
  const adminAxiosInstance = getAxiosInstance();
  const assignmentRequest = getAssignmentsRequestBody({
    orgType: orgType,
    orgArray: orgIds,
    aggregationQuery: false,
    paginate: false,
    isCollectionGroupQuery: false,
    restrictToOpenAssignments: true,
    excludeTestData: true,
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

// This function should take into two sets of IOrgslist (admin and student) and determine
// the intersection of the two org lists with the highest juridiction
export const adminOrgIntersection = (participantData, adminOrgs) => {
  const userOrgs = _pick(participantData, Object.values(ORG_TYPES));

  const orgIntersection = {};
  for (const orgName of Object.values(ORG_TYPES)) {
    orgIntersection[orgName] = _intersection(_get(userOrgs, orgName)?.current, _get(adminOrgs, orgName));
  }

  return orgIntersection;
};

// return the orgj
export const highestAdminOrgIntersection = (participantData, adminOrgs) => {
  const orgIntersection = adminOrgIntersection(participantData, adminOrgs);
  for (const orgType of ORG_TYPES_IN_ORDER) {
    if (!_isEmpty(orgIntersection[orgType])) {
      return { orgType, orgIds: orgIntersection[orgType] };
    }
  }
};
