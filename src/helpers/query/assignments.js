import _fromPairs from "lodash/fromPairs";
import _get from "lodash/get";
import _head from "lodash/head";
import _isEmpty from "lodash/isEmpty";
import _last from "lodash/last";
import _mapValues from "lodash/mapValues";
import _toPairs from "lodash/toPairs";
import _union from "lodash/union";
import _without from "lodash/without";
import { convertValues, getAxiosInstance, mapFields, orderByDefault } from "./utils";
import { getOrgsRequestBody } from "./orgs";

export const getAssignmentsRequestBody = ({
  adminId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  skinnyQuery = false,
}) => {
  const requestBody = {
    structuredQuery: {}
  };

  if(!aggregationQuery) {
    if(paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }
    
    if(skinnyQuery) {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "assessments" },
          { fieldPath: "started" },
          { fieldPath: "completed" },
        ]
      };
    } else {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "assessments" },
          { fieldPath: "assigningOrgs" },
          { fieldPath: "completed" },
          { fieldPath: "dateAssigned" },
          { fieldPath: "dateClosed" },
          { fieldPath: "dateOpened" },
          { fieldPath: "started" },
          { fieldPath: "id" },
        ]
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: "assignments",
      allDescendants: true,
    }
  ];

  requestBody.structuredQuery.where = {
    fieldFilter: {
      field: { fieldPath: "id" },
      op: "EQUAL",
      value: { stringValue: adminId }
    }
  }

  if(aggregationQuery) {
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

export const getScoresRequestBody = async ({
  adminId,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  skinnyQuery = false,
}) => {
  const requestBody = {
    structuredQuery: {}
  };

  if(!aggregationQuery) {
    if(paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }
    
    if(skinnyQuery) {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "assessments" },
          { fieldPath: "started" },
          { fieldPath: "completed" },
        ]
      };
    } else {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "assessments" },
          { fieldPath: "assigningOrgs" },
          { fieldPath: "completed" },
          { fieldPath: "dateAssigned" },
          { fieldPath: "dateClosed" },
          { fieldPath: "dateOpened" },
          { fieldPath: "started" },
          { fieldPath: "id" },
        ]
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: "assignments",
      allDescendants: true,
    }
  ];

  requestBody.structuredQuery.where = {
    fieldFilter: {
      field: { fieldPath: "id" },
      op: "EQUAL",
      value: { stringValue: adminId }
    }
  }

  if(aggregationQuery) {
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

export const scoresPageFetcher = async (adminId, pageLimit, page) => {
  const adminAxiosInstance = getAxiosInstance();
  const appAxiosInstance = getAxiosInstance('app');
  console.log('axios instance:', adminAxiosInstance)
  const requestBody = getAssignmentsRequestBody({
    adminId: adminId,
    aggregationQuery: false,
    pageLimit: pageLimit.value,
    page: page.value,
    paginate: true,
    skinnyQuery: false,
  })
  console.log('requestBody', requestBody)

  console.log(`Fetching page ${page.value} for ${adminId}`);
  const assignmentResponse = adminAxiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
  console.log('assignmentPromise', assignmentResponse)
  const assignmentData = Promise.all(assignmentResponse)
  console.log('assignmentData', assignmentData)
  return assignmentResponse
}