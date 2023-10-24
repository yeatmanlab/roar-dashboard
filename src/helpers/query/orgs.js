import _get from "lodash/get";
import _head from "lodash/head";
import _intersection from "lodash/intersection";
import _uniq from "lodash/uniq";
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
    console.log("Org Counter, not super admin");
    if (["groups", "families"].includes(activeOrgType.value)) {
      return adminOrgs.value[activeOrgType.value]?.length ?? 0;
    }
    
    const {
      districts: districtIds = [],
      schools: schoolIds = [],
      classes: classIds = [],
    } = adminOrgs.value;

    if (activeOrgType.value === "districts") {
      // Count all of the districts in the adminOrgs but also add districts from admin schools and classes
      const schoolPromises = schoolIds.map((schoolId) => {
        return fetchDocById("schools", schoolId, ["districtId"]);
      });

      const classPromises = classIds.map((classId) => {
        return fetchDocById("classes", classId, ["districtId"]);
      });

      const schools = await Promise.all(schoolPromises);
      const classes = await Promise.all(classPromises);

      districtIds.push(...schools.map(({ districtId }) => districtId));
      districtIds.push(...classes.map(({ districtId }) => districtId));
      return _uniq(districtIds).length;
    } else if (activeOrgType.value === "schools") {
      return fetchDocById("districts", selectedDistrict.value, ["schools"]).then(async ({ schools }) => {
        if (districtIds.includes(selectedDistrict.value)) {
          return schools?.length ?? 0;
        } else if (schoolIds.length > 0) {
          return _intersection(schools ?? [], schoolIds).length ?? 0;
        } else if (classIds.length > 0) {
          // If we get here, there's no way that the selectedDistrict is not also the parent district of their admin class(es).
          const classPromises = classIds.map((classId) => {
            return fetchDocById("classes", classId, ["schoolId"]);
          });

          const classes = await Promise.all(classPromises);
          return _intersection(schools, classes.map(({ schoolId }) => schoolId)).length;
        }

        return 0;
      });
    } else if (activeOrgType.value === "classes") {
      if (selectedSchool.value) {
        return fetchDocById("schools", selectedSchool.value, ["classes"]).then((school) => {
          console.log("in orgs counter", districtIds);
          if (districtIds.includes(selectedDistrict.value) || schoolIds.includes(selectedSchool.value)) {
            return school.classes?.length ?? 0;
          }
          return _intersection(school.classes ?? [], classIds).length;
        });
      }
      return 0;
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
    if (["groups", "families"].includes(orgType)) {
      const promises = (adminOrgs.value[orgType] ?? []).map((orgId) => {
        return fetchDocById(orgType, orgId, ["name", "id"]);
      })
      return Promise.all(promises);
    } else if (orgType === "districts") {
      // First grab all the districts in adminOrgs
      const promises = (adminOrgs.value[orgType] ?? []).map((orgId) => {
        return fetchDocById(orgType, orgId, ["name", "id"]);
      });
      
      const schoolPromises = (adminOrgs.value["schools"] ?? []).map((schoolId) => {
        return fetchDocById("schools", schoolId, ["districtId"]);
      });

      const classPromises = (adminOrgs.value["classes"] ?? []).map((classId) => {
        return fetchDocById("classes", classId, ["districtId"]);
      });

      const schools = await Promise.all(schoolPromises);
      const classes = await Promise.all(classPromises);
      const districtIds = schools.map((school) => school.districtId);
      districtIds.push(...classes.map((class_) => class_.districtId));

      for (const districtId of districtIds) {
        promises.push(fetchDocById(orgType, districtId, ["name", "id"]));
      }

      return Promise.all(promises);
    } else if (orgType === "schools") {
      const districtDoc = await fetchDocById("districts", selectedDistrict.value, ["schools"]);
      if ((adminOrgs.value["districts"] ?? []).includes(selectedDistrict.value)) {
        const promises = (districtDoc.schools ?? []).map((schoolId) => {
          return fetchDocById("schools", schoolId, ["name", "id"]);
        });
        return Promise.all(promises);
      } else if ((adminOrgs.value["schools"] ?? []).length > 0) {
        const schoolIds = _intersection(adminOrgs.value["schools"], districtDoc.schools);
        const promises = (schoolIds ?? []).map((schoolId) => {
          return fetchDocById("schools", schoolId, ["name", "id"]);
        });
        return Promise.all(promises);
      } else if ((adminOrgs.value["classes"] ?? []).length > 0) {
        const classPromises = (adminOrgs.value["classes"] ?? []).map((classId) => {
          return fetchDocById("classes", classId, ["schoolId"]);
        });
        const classes = await Promise.all(classPromises);
        const schoolIds = _intersection(districtDoc.schools, classes.map((class_) => class_.schoolId));
        const promises = (schoolIds ?? []).map((schoolId) => {
          return fetchDocById("schools", schoolId, ["name", "id"]);
        });
        return Promise.all(promises);
      }

      return Promise.resolve([]);
    }
  }
}

export const orgPageFetcher = async (
  activeOrgType,
  selectedDistrict,
  selectedSchool,
  orderBy,
  pageLimit,
  page,
  isSuperAdmin,
  adminOrgs,
) => {
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
    if (activeOrgType.value === "schools" && (adminOrgs.value["districts"] ?? []).includes(selectedDistrict.value)) {
      return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
    } else if (activeOrgType.value === "classes" && (
      (adminOrgs.value["schools"] ?? []).includes(selectedSchool.value) || (adminOrgs.value["districts"] ?? []).includes(selectedDistrict.value)
    )) {
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
    return orgPageFetcher(
      activeOrgType,
      selectedDistrict,
      selectedSchool,
      orderBy,
      // Set page limit to max array length in javascript.
      { value: 2**31 - 1 },
      { value: 0 },
      isSuperAdmin,
      adminOrgs,
    );
  }
};
