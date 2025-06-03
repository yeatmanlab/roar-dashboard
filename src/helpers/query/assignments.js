import { toValue, toRaw } from 'vue';
import _find from 'lodash/find';
import _flatten from 'lodash/flatten';
import _get from 'lodash/get';
import _groupBy from 'lodash/groupBy';
import _mapValues from 'lodash/mapValues';
import _replace from 'lodash/replace';
import _uniq from 'lodash/uniq';
import _without from 'lodash/without';
import _isEmpty from 'lodash/isEmpty';
import { convertValues, getAxiosInstance, getProjectId, mapFields } from './utils';
import { pluralizeFirestoreCollection, isLevante } from '@/helpers';

const userSelectFields = ['name', 'assessmentPid', 'username', 'studentData', 'schools', 'classes', 'userType'];

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

  if (adminId && (orgId || orgArray)) {
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

    if (!_isEmpty(orgArray)) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: {
            fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}`,
          },
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
    } else {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: {
            fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}`,
          },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: orgId },
        },
      });
    }

    if (!_isEmpty(grades)) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: 'userData.grade' },
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

export const getFilteredScoresRequestBody = ({
  adminId,
  orgId,
  orgType,
  orgArray,
  filter,
  select = ['scores', 'reliable', 'engagementFlags'],
  aggregationQuery,
  grades,
  paginate = true,
  page,
  pageLimit,
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
            field: { fieldPath: 'assignmentId' },
            op: 'EQUAL',
            value: { stringValue: adminId },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: 'taskId' },
            op: 'EQUAL',
            value: { stringValue: filter.taskId },
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
  if (!_isEmpty(orgArray)) {
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: {
          fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}`,
        },
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
  } else {
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: {
          fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}`,
        },
        op: 'ARRAY_CONTAINS',
        value: { stringValue: orgId },
      },
    });
  }
  if (filter) {
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      compositeFilter: {
        op: 'OR',
        filters: [
          {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  compositeFilter: {
                    op: 'OR',
                    filters: [
                      {
                        fieldFilter: {
                          field: { fieldPath: 'userData.schoolLevel' },
                          op: 'EQUAL',
                          value: { stringValue: 'elementary' },
                        },
                      },
                      {
                        fieldFilter: {
                          field: { fieldPath: 'userData.schoolLevel' },
                          op: 'EQUAL',
                          value: { stringValue: 'early-childhood' },
                        },
                      },
                    ],
                  },
                },
                // Add filter inequalities here
                // Inequalities that match elementary school students
              ],
            },
          },
          {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  compositeFilter: {
                    op: 'OR',
                    filters: [
                      {
                        fieldFilter: {
                          field: { fieldPath: 'userData.schoolLevel' },
                          op: 'EQUAL',
                          value: { stringValue: 'middle' },
                        },
                      },
                      {
                        fieldFilter: {
                          field: { fieldPath: 'userData.schoolLevel' },
                          op: 'EQUAL',
                          value: { stringValue: 'high' },
                        },
                      },
                      {
                        fieldFilter: {
                          field: { fieldPath: 'userData.schoolLevel' },
                          op: 'Equal',
                          value: { stringValue: 'postsecondary' },
                        },
                      },
                    ],
                  },
                },
                // Add filter inequalities here
                // Inequalities that match middle and high school students
              ],
            },
          },
        ],
      },
    });
    if (filter.value === 'Green') {
      // If the filter requests average students, define filters in which
      // elementary school students have the inequality percentileScore >= 50
      requestBody.structuredQuery.where.compositeFilter.filters[4].compositeFilter.filters[0].compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { doubleValue: 50 },
          },
        },
      );
      // middle/high school students have the inequality categoryScore >= upper cutoff
      requestBody.structuredQuery.where.compositeFilter.filters[4].compositeFilter.filters[1].compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { doubleValue: filter.cutoffs.above }, // For middle/high students, the same field applies but the inequality changes.
          },
        },
      );
    } else if (filter.value === 'Yellow') {
      // If the filter requests some support students, define filters in which
      // elementary school students have the inequality percentileScore < 50 and > 25
      requestBody.structuredQuery.where.compositeFilter.filters[4].compositeFilter.filters[0].compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'LESS_THAN',
            value: { doubleValue: 50 },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'GREATER_THAN',
            value: { doubleValue: 25 },
          },
        },
      );
      // middle/high school students have the inequality categoryScore < upper cutoff and > some cutoff
      requestBody.structuredQuery.where.compositeFilter.filters[4].compositeFilter.filters[1].compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'LESS_THAN',
            value: { doubleValue: filter.cutoffs.above }, // For middle/high students, the same field applies but the inequality changes.
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'GREATER_THAN',
            value: { doubleValue: filter.cutoffs.some }, // For middle/high students, the same field applies but the inequality changes.
          },
        },
      );
    } else if (filter.value === 'Pink') {
      // If the filter requests extra support students, define filters in which
      // elementary school students have the inequality percentileScore <= 25
      requestBody.structuredQuery.where.compositeFilter.filters[4].compositeFilter.filters[0].compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'LESS_THAN_OR_EQUAL',
            value: { doubleValue: 25 },
          },
        },
      );
      // middle/high school students have the inequality categoryScore <= some cutoff
      requestBody.structuredQuery.where.compositeFilter.filters[4].compositeFilter.filters[1].compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'LESS_THAN_OR_EQUAL',
            value: { doubleValue: filter.cutoffs.some }, // For middle/high students, the same field applies but the inequality changes.
          },
        },
      );
    }
    if (!_isEmpty(grades)) {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: 'userData.grade' },
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
            field: {
              fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}`,
            },
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

export const assignmentCounter = (adminId, orgType, orgId, filters = [], orderBy = []) => {
  const adminAxiosInstance = getAxiosInstance();
  const appAxiosInstance = getAxiosInstance('app');

  // Only allow one non-org filter
  let nonOrgFilter = null;
  let orgFilters = null;
  let gradeFilters = null;
  filters.forEach((filter) => {
    if (filter.collection === 'schools') {
      orgFilters = filter;
    } else if (filter.collection === 'grade') {
      gradeFilters = filter;
    } else if (filter.collection !== 'schools') {
      if (nonOrgFilter) {
        throw new Error('You may specify at most one filter');
      } else {
        nonOrgFilter = filter;
      }
    }
  });
  let requestBody;
  if (nonOrgFilter && nonOrgFilter.collection === 'scores') {
    let orgFilter = null;
    let gradeFilter = null;
    if (orgFilters && orgFilters.collection === 'schools' && !_isEmpty(orgFilters.value)) {
      orgFilter = orgFilters.value;
    }
    if (gradeFilters && gradeFilters.collection === 'grade') {
      gradeFilter = gradeFilters.value;
    }
    requestBody = getFilteredScoresRequestBody({
      adminId: adminId,
      orgType: orgFilter ? 'school' : orgType,
      orgId: orgFilter ? null : orgId,
      orgArray: orgFilter,
      grades: gradeFilter,
      filter: nonOrgFilter,
      aggregationQuery: true,
    });
    return appAxiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
      return Number(convertValues(data[0].result?.aggregateFields?.count));
    });
  } else {
    let userFilter = null;
    let orgFilter = null;
    let gradeFilter = null;
    if (nonOrgFilter && nonOrgFilter.collection === 'users' && nonOrgFilter.collection === 'assignments') {
      userFilter = nonOrgFilter;
    }
    if (orgFilters && orgFilters.collection === 'schools' && !_isEmpty(orgFilters.value)) {
      orgFilter = orgFilters.value;
    }
    if (gradeFilters && gradeFilters.collection === 'grade') {
      gradeFilter = gradeFilters.value;
    }
    const requestBody = getAssignmentsRequestBody({
      adminId: adminId,
      orgType: orgFilter ? 'school' : orgType,
      orgId: orgFilter ? null : orgId,
      orgArray: orgFilter,
      aggregationQuery: true,
      filter: userFilter || nonOrgFilter,
      grades: gradeFilter,
      orderBy: toRaw(orderBy),
    });
    return adminAxiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
      return Number(convertValues(data[0].result?.aggregateFields?.count));
    });
  }
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
  filters = [],
  orderBy = [],
) => {
  const adminAxiosInstance = getAxiosInstance();
  const appAxiosInstance = getAxiosInstance('app');
  const adminProjectId = getProjectId('admin');
  const appProjectId = getProjectId('app');

  // Only allow one non-org filter
  let nonOrgFilter = null;
  let orgFilters = null;
  let gradeFilters = null;
  filters?.forEach((filter) => {
    if (filter.collection === 'schools') {
      orgFilters = filter;
    } else if (filter.collection === 'grade') {
      gradeFilters = filter;
    } else if (filter.collection !== 'schools') {
      if (nonOrgFilter) {
        throw new Error('You may specify at most one filter');
      } else {
        nonOrgFilter = filter;
      }
    }
  });

  // Handle filtering based on scores
  if (nonOrgFilter && nonOrgFilter.collection === 'scores') {
    let orgFilter = null;
    let gradeFilter = null;
    if (orgFilters && orgFilters.collection === 'schools' && !_isEmpty(orgFilters.value)) {
      orgFilter = orgFilters.value;
    }
    if (gradeFilters && gradeFilters.collection === 'grade') {
      gradeFilter = gradeFilters.value;
    }
    const requestBody = getFilteredScoresRequestBody({
      adminId: adminId,
      orgType: orgFilter ? 'school' : orgType,
      orgId: orgFilter ? null : orgId,
      orgArray: orgFilter,
      filter: nonOrgFilter,
      aggregationQuery: false,
      grades: gradeFilter,
      paginate: true,
      page: page.value,
      pageLimit: pageLimit.value,
    });
    console.log(
      `Fetching page ${page.value} for ${adminId} with filter ${filters[0].value} on field ${filters[0].field}`,
    );
    return appAxiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
      const scoresData = mapFields(data, true);

      // Generate a list of user docs paths
      const userDocPaths = _uniq(
        _without(
          data.map((scoreDoc) => {
            if (scoreDoc.document?.name) {
              return _replace(scoreDoc.document.name.split('/runs/')[0], appProjectId, adminProjectId);
            } else {
              return undefined;
            }
          }),
          undefined,
        ),
      );

      // Use a batch get to grab the user docs
      const batchUserDocs = await adminAxiosInstance
        .post(':batchGet', {
          documents: userDocPaths,
          mask: { fieldPaths: userSelectFields },
        })
        .then(({ data }) => {
          return _without(
            data.map(({ found }) => {
              if (found) {
                return {
                  name: found.name,
                  userId: found.name.split('/users/')[1],
                  data: _mapValues(found.fields, (value) => convertValues(value)),
                };
              }
              return undefined;
            }),
            undefined,
          );
        });

      // Generate a list of assignment doc paths
      const assignmentDocPaths = userDocPaths.map((userDocPath) => {
        return `${userDocPath}/assignments/${adminId}`;
      });

      // Batch get assignment docs
      const batchAssignmentDocs = await adminAxiosInstance
        .post(':batchGet', {
          documents: assignmentDocPaths,
          mask: { fieldPaths: assignmentSelectFields },
        })
        .then(({ data }) => {
          return _without(
            data.map(({ found }) => {
              if (found) {
                return {
                  name: found.name,
                  userId: found.name.split('/users/')[1].split('/')[0],
                  data: _mapValues(found.fields, (value) => convertValues(value)),
                };
              }
              return undefined;
            }),
            undefined,
          );
        });

      // Merge the scores into the assignment object
      const unretrievedScores = [];
      const initialScoredAssignments = batchAssignmentDocs.map((assignment) => {
        const scoredAssessments = _without(
          assignment.data.assessments.map((assessment) => {
            const runId = assessment.runId;
            const scoresObject = _get(_find(scoresData, { id: runId }), 'scores');
            const reliable = _get(_find(scoresData, { id: runId }), 'reliable');
            const engagementFlags = _get(_find(scoresData, { id: runId }), 'engagementFlags');
            if (!scoresObject && runId) {
              const runPath = `projects/${appProjectId}/databases/(default)/documents/users/${assignment.userId}/runs/${runId}`;
              unretrievedScores.push(runPath);
            }
            return {
              ...assessment,
              scores: scoresObject,
              reliable,
              engagementFlags,
            };
          }),
          undefined,
        );
        return {
          userId: assignment.userId,
          data: {
            ...assignment.data,
            assessments: scoredAssessments,
          },
        };
      });

      // Use the list of unretrieved scores and batchGet
      const otherScores = await appAxiosInstance
        .post(':batchGet', {
          documents: unretrievedScores,
          mask: { fieldPaths: ['scores', 'reliable', 'engagementFlags'] },
        })
        .then(({ data }) => {
          return _without(
            data.map(({ found }) => {
              if (found) {
                return {
                  id: found.name.split('/runs/')[1],
                  ..._mapValues(found.fields, (value) => convertValues(value)),
                };
              }
              return undefined;
            }),
            undefined,
          );
        });

      // Merge the newly retrieved scores with the scoredAssignments object
      const scoredAssignments = initialScoredAssignments.map((assignment) => {
        const scoredAssessments = assignment.data.assessments.map((assessment) => {
          const runId = assessment.runId;
          const runScores = _get(_find(otherScores, { id: runId }), 'scores');
          const reliable = _get(_find(otherScores, { id: runId }), 'reliable');
          const engagementFlags = _get(_find(otherScores, { id: runId }), 'engagementFlags');
          if (runScores) {
            return {
              ...assessment,
              scores: runScores,
              reliable,
              engagementFlags,
            };
          } else {
            return assessment;
          }
        });
        return {
          userId: assignment.userId,
          data: {
            ...assignment.data,
            assessments: scoredAssessments,
          },
        };
      });

      // Integrate the assignment and scores objects
      return _without(
        data.map((score) => {
          if (_get(score, 'document')) {
            const userId = score.document.name.split('/users/')[1].split('/runs/')[0];
            const assignmentDoc = _find(scoredAssignments, {
              userId: userId,
            });
            const userDoc = _find(batchUserDocs, { userId: userId });
            return {
              user: {
                ...userDoc.data,
                userId: userDoc.userId,
              },
              assignment: assignmentDoc.data,
            };
          } else {
            return undefined;
          }
        }),
        undefined,
      );
    });
  } else {
    let userFilter = null;
    let orgFilter = null;
    let gradeFilter = null;
    if (nonOrgFilter && nonOrgFilter.collection === 'users') {
      if (nonOrgFilter.field === 'grade') {
        gradeFilter = nonOrgFilter.value;
      } else {
        userFilter = nonOrgFilter;
      }
    }
    if (orgFilters && orgFilters.collection === 'schools' && !_isEmpty(orgFilters.value)) {
      orgFilter = orgFilters.value;
    }
    if (gradeFilters && gradeFilters.collection === 'grade') {
      gradeFilter = gradeFilters.value;
    }
    const requestBody = getAssignmentsRequestBody({
      adminId: adminId,
      orgType: orgFilter ? 'school' : orgType,
      orgId: orgFilter ? null : orgId,
      orgArray: orgFilter,
      aggregationQuery: false,
      pageLimit: pageLimit.value,
      page: page.value,
      paginate: paginate,
      select: select,
      filter: userFilter || nonOrgFilter,
      grades: gradeFilter,
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

      let batchSurveyDocs = [];
      if (isLevante) {
        console.log('adminId: ', adminId);
        // Batch get survey response docs
        batchSurveyDocs = await Promise.all(
          userDocPaths.map(async (userDocPath) => {
            const userId = userDocPath.split('/users/')[1];
            const surveyQuery = {
              structuredQuery: {
                from: [
                  {
                    collectionId: 'surveyResponses',
                  },
                ],
                where: {
                  fieldFilter: {
                    field: { fieldPath: 'administrationId' },
                    op: 'EQUAL',
                    value: { stringValue: adminId },
                  },
                },
              },
            };

            try {
              const { data } = await adminAxiosInstance.post(`users/${userId}:runQuery`, surveyQuery);

              const validResponses = data
                .filter((doc) => doc.document)
                .map((doc) => ({
                  name: doc.document.name,
                  ..._mapValues(doc.document.fields, (value) => convertValues(value)),
                }));

              return validResponses.length > 0 ? validResponses[0] : null;
            } catch (error) {
              console.error('Error fetching survey response: ', error);
              return null;
            }
          }),
        );
      }

      // Merge assignments, users, and survey data
      const scoresObj = assignmentData.map((assignment, index) => {
        const user = batchUserDocs.find((userDoc) => userDoc.name.includes(assignment.parentDoc));
        const surveyResponse = isLevante ? batchSurveyDocs[index] : null;

        let progress = 'assigned';
        if (surveyResponse) {
          // Check completion based on user type
          if (user.data.userType === 'student') {
            progress = surveyResponse.general?.isComplete ? 'completed' : 'started';
          } else if (['parent', 'teacher'].includes(user.data.userType)) {
            // For parent/teacher, check both general and specific parts
            const generalComplete = surveyResponse.general?.isComplete || false;
            const specificItems = surveyResponse?.specific || [];

            if (specificItems.length > 0) {
              const allSpecificComplete = specificItems.every((item) => item.isComplete === true);
              // Both general and all specific items must be complete
              progress = generalComplete && allSpecificComplete ? 'completed' : 'started';
            } else {
              progress = 'started';
            }
          }
        }

        return {
          assignment,
          user: user.data,
          roarUid: user.name.split('/users/')[1],
          ...(isLevante && {
            survey: {
              progress,
              ...surveyResponse,
            },
          }),
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
  }
};

/**
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
