import { getAxiosInstance, mapFields } from "./utils";

export const getTasksRequestBody = ({
  registered = true,
  orderBy,
  aggregationQuery,
  pageLimit,
  page,
  paginate = false,
  select = ["name"],
}) => {
  const requestBody = { structuredQuery: { } };

  if (orderBy) {
    requestBody.structuredQuery.orderBy = orderBy;
  }

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    requestBody.structuredQuery.select = {
      fields: select.map((field) => ({ fieldPath: field }))
    };
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: "tasks",
      allDescendants: false,
    }
  ];

  if (registered) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "registered" },
        op: "EQUAL",
        value: { booleanValue: true }
      }
    }
  }

  if (aggregationQuery) {
    return {
      structuredAggregationQuery: {
        ...requestBody,
        aggregations: [{
          alias: "count",
          count: {},
        }]
      }
    }
  }

  return requestBody;
}

export const taskFetcher = async (registered = true, select = ["name"]) => {
  const axiosInstance = getAxiosInstance("app");
  const requestBody = getTasksRequestBody({
    registered,
    aggregationQuery: false,
    paginate: false,
    select: select,
  });

  return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
};
