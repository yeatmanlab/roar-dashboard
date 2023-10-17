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

export const getScoresRequestBody = ({
  adminId,
  orderBy,
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
    
    // TODO: determine skinny query selects after optimizing scores page
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
      allDecendants: true,
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
  const axiosInstance = getAxiosInstance();
  console.log('axios instance:', axiosInstance)
  const requestBody = getScoresRequestBody({
    adminId: adminId,
    aggregationQuery: false,
    pageLimit: pageLimit.value,
    page: page.value,
    paginate: true,
    skinnyQuery: true,
  })
  console.log('requestBody', requestBody)

  console.log(`Fetching page ${page.value} for ${adminId}`);
  return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
}