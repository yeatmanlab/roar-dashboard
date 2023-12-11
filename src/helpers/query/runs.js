import { convertValues, getAxiosInstance, mapFields } from './utils';
import { pluralizeFirestoreCollection } from '@/helpers';

export const getRunsRequestBody = ({
  administrationId,
  orgType,
  orgId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = ['scores.computed'],
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
      collectionId: 'runs',
      allDescendants: true,
    },
  ];

  if (administrationId && orgId) {
    requestBody.structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'id' },
              op: 'EQUAL',
              value: { stringValue: administrationId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: `readOrgs.${pluralizeFirestoreCollection(orgType)}` },
              op: 'ARRAY_CONTAINS',
              value: { stringValue: orgId },
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
  } else {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'bestRun' },
        op: 'EQUAL',
        value: { booleanValue: true },
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

export const runCounter = (administrationId, orgType, orgId) => {
  const axiosInstance = getAxiosInstance('app');
  const requestBody = getRunsRequestBody({
    administrationId,
    orgType,
    orgId,
    aggregationQuery: true,
  });
  return axiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
    return Number(convertValues(data[0].result?.aggregateFields?.count));
  });
};

export const runPageFetcher = async (
  administrationId,
  orgType,
  orgId,
  pageLimit,
  page,
  select = undefined,
  paginate = true,
) => {
  const appAxiosInstance = getAxiosInstance('app');
  const requestBody = getRunsRequestBody({
    administrationId,
    orgType,
    orgId,
    aggregationQuery: false,
    pageLimit: pageLimit.value,
    page: page.value,
    paginate: paginate,
    select: select,
  });
  console.log(`Fetching scores page ${page.value} for ${administrationId}`);
  return appAxiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
    const runData = mapFields(data);

    return runData;
  });
};
