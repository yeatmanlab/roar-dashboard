import _get from "lodash/get";
import _head from "lodash/head";
import { convertValues, getAxiosInstance, mapFields, orderByDefault } from "./utils";

export const getOrgsRequestBody = ({
  orgType,
  parentDistrict,
  parentSchool,
  orderBy,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  skinnyQuery = false,
}) => {
  const requestBody = {
    structuredQuery: {
      orderBy: orderBy ?? orderByDefault,
    }
  };

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    if (skinnyQuery) {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "id" },
          { fieldPath: "name" },
        ]
      };
    } else {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "abbreviation" },
          { fieldPath: "address" },
          { fieldPath: "clever" },
          { fieldPath: "districtContact" },
          { fieldPath: "id" },
          { fieldPath: "mdrNumber" },
          { fieldPath: "name" },
          { fieldPath: "ncesId" },
          { fieldPath: "tags" },
        ]
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: orgType,
      allDescendants: false,
    }
  ];

  if (orgType === "schools" && parentDistrict) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "districtId" },
        op: "EQUAL",
        value: { stringValue: parentDistrict }
      }
    }
  } else if (orgType === "classes" && parentSchool) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "schoolId" },
        op: "EQUAL",
        value: { stringValue: parentSchool }
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

export const orgCounter = async (activeOrgType, selectedDistrict, selectedSchool, orderBy) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: activeOrgType.value,
    parentDistrict: selectedDistrict.value,
    parentSchool: selectedSchool.value,
    aggregationQuery: true,
    orderBy: orderBy.value,
    paginate: false,
    skinnyQuery: true,
  });
  console.log(`Fetching count for ${activeOrgType.value}`);
  return axiosInstance.post(":runAggregationQuery", requestBody).then(({ data }) => {
    return Number(convertValues(data[0].result?.aggregateFields?.count));
  })
}

export const orgFetcher = async (orgType, selectedDistrict) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: orgType,
    parentDistrict: orgType === "schools" ? selectedDistrict.value : null,
    aggregationQuery: false,
    paginate: false,
    skinnyQuery: true,
  });

  if (orgType === "districts") {
    console.log(`Fetching ${orgType}`);
  } else if (orgType === "schools") {
    console.log(`Fetching ${orgType} for ${selectedDistrict.value}`);
  }

  return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
}

export const orgPageFetcher = async (activeOrgType, selectedDistrict, selectedSchool, orderBy, pageLimit, page) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: activeOrgType.value,
    parentDistrict: selectedDistrict.value,
    parentSchool: selectedSchool.value,
    aggregationQuery: false,
    orderBy: orderBy.value,
    pageLimit: pageLimit.value,
    paginate: true,
    page: page.value,
    skinnyQuery: false,
  });

  console.log(`Fetching page ${page.value} for ${activeOrgType.value}`);
  return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
}

export const orgFetchAll = async (activeOrgType, selectedDistrict, selectedSchool, orderBy) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: activeOrgType.value,
    parentDistrict: selectedDistrict.value,
    parentSchool: selectedSchool.value,
    aggregationQuery: false,
    orderBy: orderBy.value,
    paginate: false,
    skinnyQuery: false,
  });

  return await axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
}
