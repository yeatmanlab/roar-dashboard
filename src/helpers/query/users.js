import _mapValues from "lodash/mapValues";
import { convertValues, getAxiosInstance, mapFields } from "./utils";

export const getUsersRequestBody = ({
  userIds,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  skinnyQuery = false,
}) => {
  const requestBody = {
    structuredQuery: {}
  }

  if(!aggregationQuery) {
    if(paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    if(skinnyQuery) {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "name" }
        ]
      }
    } else {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "name" }
        ]
      }
    }
  }
  requestBody.structuredQuery.from = [
    {
      collectionId: "users",
      allDescendants: false,
    }
  ]

  requestBody.structuredQuery.where = {
    fieldFilter: {
      field: { fieldPath: "id" }, // change this to accept document Id, if we need 
      op: "IN",
      value: {
        arrayValue: {
          values: [
            userIds.map(userId => {
              return { stringValue: userId }
            })
          ]
        }
      }
    }
  }

  if(aggregationQuery) {
    return {
      structuredAggregationQuery: {
        ...requestBody,
        aggregations: [{
          alias: "count",
          count: {}
        }]
      }
    }
  }

  return requestBody
}

export const usersPageFetcher = async (userIds, pageLimit, page) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getUsersRequestBody({
    userIds,
    aggregationQuery: false,
    pageLimit: pageLimit.value, 
    page: page.value,
    paginate: true,
    skinnyQuery: false,
  })
  console.log('requestBody', requestBody)

  console.log(`Fetching page ${page.value} for ${userIds}`)
  const response = axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
  console.log('users response', response)
  return response;
}