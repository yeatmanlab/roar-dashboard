import { toValue } from 'vue';
import { convertValues, getAxiosInstance, mapFields } from './utils';

/**
 * Constructs the request body for fetching users.
 *
 * @param {Object} params - The parameters for constructing the request body.
 * @param {Array<string>} [params.userIds=[]] - The IDs of the users to fetch.
 * @param {string} params.orgType - The type of the organization (e.g., 'districts', 'schools').
 * @param {string} params.orgId - The ID of the organization.
 * @param {boolean} params.aggregationQuery - Whether to perform an aggregation query.
 * @param {number} params.pageLimit - The maximum number of users to fetch per page.
 * @param {number} params.page - The page number to fetch.
 * @param {boolean} [params.paginate=true] - Whether to paginate the results.
 * @param {Array<string>} [params.select=['name']] - The fields to select in the query.
 * @param {string} params.orderBy - The field to order the results by.
 * @returns {Object} The constructed request body.
 * @throws {Error} If neither userIds nor orgType and orgId are provided.
 */
export const getUsersRequestBody = ({
  userIds = [],
  orgType,
  orgId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = ['name'],
  orderBy,
}) => {
  const requestBody = {
    structuredQuery: {},
  };

  if (orderBy) {
    requestBody.structuredQuery.orderBy = orderBy;
  }

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
      collectionId: 'users',
      allDescendants: false,
    },
  ];

  if (userIds.length > 0) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'id' }, // change this to accept document Id, if we need
        op: 'IN',
        value: {
          arrayValue: {
            values: [
              userIds.map((userId) => {
                return { stringValue: userId };
              }),
            ],
          },
        },
      },
    };
  } else if (orgType && orgId) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: `${orgType}.current` }, // change this to accept document Id, if we need
        op: 'ARRAY_CONTAINS',
        value: { stringValue: orgId },
      },
    };
  } else {
    throw new Error('Must provide either userIds or orgType and orgId');
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
 * Fetches a page of users based on the provided user IDs.
 *
 * @param {Array<string>} userIds - The IDs of the users to fetch.
 * @param {number} pageLimit - The maximum number of users to fetch per page.
 * @param {number} page - The page number to fetch.
 * @returns {Promise<Object>} The fetched users data.
 */
export const usersPageFetcher = async (userIds, pageLimit, page) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getUsersRequestBody({
    userIds: toValue(userIds),
    aggregationQuery: false,
    pageLimit: toValue(pageLimit),
    page: toValue(page),
    paginate: true,
  });

  console.log(`Fetching users page ${toValue(page)} for ${toValue(userIds)}`);
  return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
};

/**
 * Fetches a page of users based on the provided organization type and ID.
 *
 * @param {string} orgType - The type of the organization (e.g., 'districts', 'schools').
 * @param {string} orgId - The ID of the organization.
 * @param {number} pageLimit - The maximum number of users to fetch per page.
 * @param {number} page - The page number to fetch.
 * @param {string} orderBy - The field to order the results by.
 * @returns {Promise<Object>} The fetched users data.
 */
export const fetchUsersByOrg = async (orgType, orgId, pageLimit, page, orderBy) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getUsersRequestBody({
    orgType: toValue(orgType),
    orgId: toValue(orgId),
    aggregationQuery: false,
    pageLimit: toValue(pageLimit),
    page: toValue(page),
    paginate: true,
    select: ['username', 'name', 'studentData', 'userType'],
    orderBy: toValue(orderBy),
  });

  console.log(`Fetching users page ${toValue(page)} for ${toValue(orgType)} ${toValue(orgId)}`);
  return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
};

/**
 * Counts the number of users based on the provided organization type and ID.
 *
 * @param {string} orgType - The type of the organization (e.g., 'districts', 'schools').
 * @param {string} orgId - The ID of the organization.
 * @param {string} orderBy - The field to order the results by.
 * @returns {Promise<number>} The count of users.
 */
export const countUsersByOrg = async (orgType, orgId, orderBy) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getUsersRequestBody({
    orgType: toValue(orgType),
    orgId: toValue(orgId),
    aggregationQuery: true,
    paginate: false,
    orderBy: toValue(orderBy),
  });

  return axiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
    return Number(convertValues(data[0].result?.aggregateFields?.count));
  });
};
