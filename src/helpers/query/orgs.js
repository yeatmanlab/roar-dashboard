import _get from "lodash/get";
import _head from "lodash/head";
import { convertValues, fetchDocById, getAxiosInstance, mapFields, orderByDefault } from "./utils";

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

export const orgCounter = async (activeOrgType, selectedDistrict, selectedSchool, orderBy, isSuperAdmin, adminOrgs) => {
  if (isSuperAdmin.value) {
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
  } else {
    if (["districts", "groups", "families"].includes(activeOrgType.value)) {
      return adminOrgs.value[activeOrgType.value]?.length ?? 0;
    } else if (activeOrgType.value === "schools") {
      return fetchDocById("districts", selectedDistrict.value, ["schools"]).then((district) => {
          return district.schools?.length ?? 0;
      });
    } else if (activeOrgType.value === "classes") {
      return fetchDocById("schools", selectedSchool.value, ["classes"]).then((school) => {
          return school.classes?.length ?? 0;
      });
    }
  }
}

export const orgFetcher = async (orgType, selectedDistrict, isSuperAdmin, adminOrgs) => {
  if (isSuperAdmin.value) {
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
  } else {
    if (["districts", "groups", "families"].includes(orgType)) {
      const promises = (adminOrgs.value[orgType] ?? []).map((orgId) => {
        return fetchDocById(orgType, orgId, ["name", "id"]);
      })
      return Promise.all(promises);
    } else if (orgType === "schools") {
      const districtDoc = await fetchDocById("districts", selectedDistrict.value, ["schools"]);
      const promises = (districtDoc.schools ?? []).map((schoolId) => {
        return fetchDocById("schools", schoolId, ["name", "id"]);
      });
      return Promise.all(promises);
    }
  }
}

export const orgPageFetcher = async (activeOrgType, selectedDistrict, selectedSchool, orderBy, pageLimit, page, isSuperAdmin, adminOrgs) => {
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

  if (isSuperAdmin.value) {
    return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
  } else {
    if (["schools", "classes"].includes(activeOrgType.value)) {
      return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
    }

    const orgIds = adminOrgs.value[activeOrgType.value] ?? [];
    const promises = orgIds.map((orgId) => fetchDocById(activeOrgType.value, orgId));
    const orderField = (orderBy?.value ?? orderByDefault)[0].field.fieldPath;
    const orderDirection = (orderBy?.value?? orderByDefault)[0].direction;
    const orgs = (await Promise.all(promises)).sort(
      (a, b) => {
        if (orderDirection === "ASCENDING") return 2 * (+(a[orderField] > b[orderField])) - 1;
        if (orderDirection === "DESCENDING") return 2 * (+(b[orderField] > a[orderField])) - 1;
        return 0;
      }
    );
    return orgs.slice(page.value * pageLimit.value, (page.value + 1) * pageLimit.value);
  }
}

export const orgFetchAll = async (activeOrgType, selectedDistrict, selectedSchool, orderBy, isSuperAdmin, adminOrgs) => {
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

  if (isSuperAdmin.value) {
    return await axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
  } else {
    if (["schools", "classes"].includes(activeOrgType.value)) {
      return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
    }

    const orgIds = adminOrgs.value[activeOrgType.value] ?? [];
    const promises = orgIds.map((orgId) => fetchDocById(activeOrgType.value, orgId));
    const orderField = (orderBy?.value ?? orderByDefault)[0].field.fieldPath;
    const orderDirection = (orderBy?.value ?? orderByDefault)[0].direction;
    const orgs = (await Promise.all(promises)).sort(
      (a, b) => {
        if (orderDirection === "ASCENDING") return 2 * (+(a[orderField] > b[orderField])) - 1;
        if (orderDirection === "DESCENDING") return 2 * (+(b[orderField] > a[orderField])) - 1;
        return 0;
      }
    );
    return orgs;
  }
};
