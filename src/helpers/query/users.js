import { convertValues, getAxiosInstance, mapFields } from './utils';

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

export const usersPageFetcher = async (userIds, pageLimit, page) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getUsersRequestBody({
    userIds,
    aggregationQuery: false,
    pageLimit: pageLimit.value,
    page: page.value,
    paginate: true,
  });

  console.log(`Fetching page ${page.value} for ${userIds}`);
  return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
};

export const fetchUsersByOrg = async (orgType, orgId, pageLimit, page, orderBy) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getUsersRequestBody({
    orgType,
    orgId,
    aggregationQuery: false,
    pageLimit: pageLimit.value,
    page: page.value,
    paginate: true,
    select: ['username', 'name', 'studentData', 'userType'],
    orderBy: orderBy.value,
  });

  console.log(`Fetching users page ${page.value} for ${orgType} ${orgId}`);
  return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
};

export const countUsersByOrg = async (orgType, orgId, orderBy) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getUsersRequestBody({
    orgType,
    orgId,
    aggregationQuery: true,
    paginate: false,
    orderBy: orderBy.value,
  });

  return axiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
    return Number(convertValues(data[0].result?.aggregateFields?.count));
  });
};
