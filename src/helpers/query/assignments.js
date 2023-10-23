import _fromPairs from "lodash/fromPairs";
import _get from "lodash/get";
import _head from "lodash/head";
import _isEmpty from "lodash/isEmpty";
import _last from "lodash/last";
import _mapValues from "lodash/mapValues";
import _toPairs from "lodash/toPairs";
import _union from "lodash/union";
import _without from "lodash/without";
import _zip from "lodash/zip";
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
  return adminAxiosInstance.post(":runQuery", requestBody).then(async ({ data }) => {
    const assignmentData = mapFields(data)
    const userDocPaths = data.map((adminDoc) => {
      // Split the path, grab the userId
      const userId = adminDoc.document.name.split('/')[6]
      return `/users/${userId}/`;
    })
    const userDocPromises = []
    for (const docPath of userDocPaths) {
      userDocPromises.push(adminAxiosInstance.get(docPath).then(({ data }) => {
        return _mapValues(data.fields, (value) => convertValues(value));
      }))
    }
    const userDocData = await Promise.all(userDocPromises);
    const scoresObj = _zip(userDocData, assignmentData).map(([userData, assignmentData]) => ({
        assignment: assignmentData,
        user: userData
    }))
    return scoresObj
  });
}