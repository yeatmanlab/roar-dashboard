import _intersection from 'lodash/intersection';
import _uniq from 'lodash/uniq';
import { convertValues, fetchDocById, getAxiosInstance, mapFields, orderByDefault } from './utils';

export const getOrgsRequestBody = ({
  orgType,
  orgName,
  parentDistrict,
  parentSchool,
  orderBy,
  aggregationQuery,
  pageLimit,
  page,
  paginate = true,
  select = [
    'abbreviation',
    'address',
    'clever',
    'classlink',
    'districtContact',
    'id',
    'mdrNumber',
    'name',
    'ncesId',
    'tags',
  ],
}) => {
  const requestBody = {
    structuredQuery: {
      orderBy: orderBy ?? orderByDefault,
    },
  };

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
      collectionId: orgType,
      allDescendants: false,
    },
  ];

  requestBody.structuredQuery.where = {
    compositeFilter: {
      op: 'AND',
      filters: [
        {
          fieldFilter: {
            field: { fieldPath: 'archived' },
            op: 'EQUAL',
            value: { booleanValue: false },
          },
        },
      ],
    },
  };

  if (orgName && !(parentDistrict || parentSchool)) {
    requestBody.structuredQuery.where.compositeFilter.filters.push({
      fieldFilter: {
        field: { fieldPath: 'name' },
        op: 'EQUAL',
        value: { stringValue: orgName },
      },
    });
  } else if (orgType === 'schools' && parentDistrict) {
    if (orgName) {
      requestBody.structuredQuery.where.compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: 'name' },
            op: 'EQUAL',
            value: { stringValue: orgName },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: 'districtId' },
            op: 'EQUAL',
            value: { stringValue: parentDistrict },
          },
        },
      );
    } else {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: 'districtId' },
          op: 'EQUAL',
          value: { stringValue: parentDistrict },
        },
      });
    }
  } else if (orgType === 'classes' && parentSchool) {
    if (orgName) {
      requestBody.structuredQuery.where.compositeFilter.filters.push(
        {
          fieldFilter: {
            field: { fieldPath: 'name' },
            op: 'EQUAL',
            value: { stringValue: orgName },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: 'schoolId' },
            op: 'EQUAL',
            value: { stringValue: parentSchool },
          },
        },
      );
    } else {
      requestBody.structuredQuery.where.compositeFilter.filters.push({
        fieldFilter: {
          field: { fieldPath: 'schoolId' },
          op: 'EQUAL',
          value: { stringValue: parentSchool },
        },
      });
    }
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
      select: ['name', 'id'],
    });
    console.log(`Fetching count for ${activeOrgType.value}`);
    return axiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
      return Number(convertValues(data[0].result?.aggregateFields?.count));
    });
  } else {
    console.log('Org Counter, not super admin');
    if (['groups', 'families'].includes(activeOrgType.value)) {
      return adminOrgs.value[activeOrgType.value]?.length ?? 0;
    }

    const { districts: districtIds = [], schools: schoolIds = [], classes: classIds = [] } = adminOrgs.value;

    if (activeOrgType.value === 'districts') {
      // Count all of the districts in the adminOrgs but also add districts from admin schools and classes
      const schoolPromises = schoolIds.map((schoolId) => {
        return fetchDocById('schools', schoolId, ['districtId']);
      });

      const classPromises = classIds.map((classId) => {
        return fetchDocById('classes', classId, ['districtId']);
      });

      const schools = await Promise.all(schoolPromises);
      const classes = await Promise.all(classPromises);

      districtIds.push(...schools.map(({ districtId }) => districtId));
      districtIds.push(...classes.map(({ districtId }) => districtId));
      return _uniq(districtIds).length;
    } else if (activeOrgType.value === 'schools') {
      return fetchDocById('districts', selectedDistrict.value, ['schools']).then(async ({ schools }) => {
        if (districtIds.includes(selectedDistrict.value)) {
          return schools?.length ?? 0;
        } else if (schoolIds.length > 0) {
          return _intersection(schools ?? [], schoolIds).length ?? 0;
        } else if (classIds.length > 0) {
          // If we get here, there's no way that the selectedDistrict is not also the parent district of their admin class(es).
          const classPromises = classIds.map((classId) => {
            return fetchDocById('classes', classId, ['schoolId']);
          });

          const classes = await Promise.all(classPromises);
          return _intersection(
            schools,
            classes.map(({ schoolId }) => schoolId),
          ).length;
        }

        return 0;
      });
    } else if (activeOrgType.value === 'classes') {
      if (selectedSchool.value) {
        return fetchDocById('schools', selectedSchool.value, ['classes']).then((school) => {
          console.log('in orgs counter', districtIds);
          if (districtIds.includes(selectedDistrict.value) || schoolIds.includes(selectedSchool.value)) {
            return school.classes?.length ?? 0;
          }
          return _intersection(school.classes ?? [], classIds).length;
        });
      }
      return 0;
    }
  }
};

export const fetchOrgByName = async (orgType, orgName, selectedDistrict, selectedSchool) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: orgType,
    parentDistrict: orgType === 'schools' ? selectedDistrict.value : null,
    parentSchool: orgType === 'classes' ? selectedSchool.value : null,
    aggregationQuery: false,
    orgName,
    paginate: false,
    select: ['id', 'abbreviation'],
  });

  return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
};

export const orgFetcher = async (
  orgType,
  selectedDistrict,
  isSuperAdmin,
  adminOrgs,
  select = ['name', 'id', 'currentActivationCode'],
) => {
  if (isSuperAdmin.value) {
    const axiosInstance = getAxiosInstance();
    const requestBody = getOrgsRequestBody({
      orgType: orgType,
      parentDistrict: orgType === 'schools' ? selectedDistrict.value : null,
      aggregationQuery: false,
      paginate: false,
      select: select,
    });

    if (orgType === 'districts') {
      console.log(`Fetching ${orgType}`);
    } else if (orgType === 'schools') {
      console.log(`Fetching ${orgType} for ${selectedDistrict.value}`);
    }

    return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
  } else {
    if (['groups', 'families'].includes(orgType)) {
      const promises = (adminOrgs.value[orgType] ?? []).map((orgId) => {
        return fetchDocById(orgType, orgId, select);
      });
      return Promise.all(promises);
    } else if (orgType === 'districts') {
      // First grab all the districts in adminOrgs
      const promises = (adminOrgs.value[orgType] ?? []).map((orgId) => {
        return fetchDocById(orgType, orgId, select);
      });

      // Then add all of the district IDs listed in the docs for each school and class in adminOrgs.
      const schoolPromises = (adminOrgs.value['schools'] ?? []).map((schoolId) => {
        return fetchDocById('schools', schoolId, ['districtId']);
      });

      const classPromises = (adminOrgs.value['classes'] ?? []).map((classId) => {
        return fetchDocById('classes', classId, ['districtId']);
      });

      const schools = await Promise.all(schoolPromises);
      const classes = await Promise.all(classPromises);
      const districtIds = schools.map((school) => school.districtId);
      districtIds.push(...classes.map((class_) => class_.districtId));

      for (const districtId of districtIds) {
        promises.push(fetchDocById(orgType, districtId, select));
      }

      return Promise.all(promises);
    } else if (orgType === 'schools') {
      const districtDoc = await fetchDocById('districts', selectedDistrict.value, ['schools']);
      if ((adminOrgs.value['districts'] ?? []).includes(selectedDistrict.value)) {
        const promises = (districtDoc.schools ?? []).map((schoolId) => {
          return fetchDocById('schools', schoolId, select);
        });
        return Promise.all(promises);
      } else if ((adminOrgs.value['schools'] ?? []).length > 0) {
        const schoolIds = _intersection(adminOrgs.value['schools'], districtDoc.schools);
        const promises = (schoolIds ?? []).map((schoolId) => {
          return fetchDocById('schools', schoolId, select);
        });
        return Promise.all(promises);
      } else if ((adminOrgs.value['classes'] ?? []).length > 0) {
        const classPromises = (adminOrgs.value['classes'] ?? []).map((classId) => {
          return fetchDocById('classes', classId, ['schoolId']);
        });
        const classes = await Promise.all(classPromises);
        const schoolIds = _intersection(
          districtDoc.schools,
          classes.map((class_) => class_.schoolId),
        );
        const promises = (schoolIds ?? []).map((schoolId) => {
          return fetchDocById('schools', schoolId, select);
        });
        return Promise.all(promises);
      }

      return Promise.resolve([]);
    }
  }
};

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
  });

  console.log(`Fetching page ${page.value} for ${activeOrgType.value}`);

  if (isSuperAdmin.value) {
    return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
  } else {
    if (activeOrgType.value === 'schools' && (adminOrgs.value['districts'] ?? []).includes(selectedDistrict.value)) {
      return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
    } else if (
      activeOrgType.value === 'classes' &&
      ((adminOrgs.value['schools'] ?? []).includes(selectedSchool.value) ||
        (adminOrgs.value['districts'] ?? []).includes(selectedDistrict.value))
    ) {
      return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
    }

    const orgIds = adminOrgs.value[activeOrgType.value] ?? [];
    const promises = orgIds.map((orgId) => fetchDocById(activeOrgType.value, orgId));
    const orderField = (orderBy?.value ?? orderByDefault)[0].field.fieldPath;
    const orderDirection = (orderBy?.value ?? orderByDefault)[0].direction;
    const orgs = (await Promise.all(promises)).sort((a, b) => {
      if (orderDirection === 'ASCENDING') return 2 * +(a[orderField] > b[orderField]) - 1;
      if (orderDirection === 'DESCENDING') return 2 * +(b[orderField] > a[orderField]) - 1;
      return 0;
    });
    return orgs.slice(page.value * pageLimit.value, (page.value + 1) * pageLimit.value);
  }
};

export const orgFetchAll = async (
  activeOrgType,
  selectedDistrict,
  selectedSchool,
  orderBy,
  isSuperAdmin,
  adminOrgs,
  select,
) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: activeOrgType.value,
    parentDistrict: selectedDistrict.value,
    parentSchool: selectedSchool.value,
    aggregationQuery: false,
    orderBy: orderBy.value,
    paginate: false,
    select,
  });

  if (isSuperAdmin.value) {
    return await axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
  } else {
    return orgPageFetcher(
      activeOrgType,
      selectedDistrict,
      selectedSchool,
      orderBy,
      // Set page limit to max array length in javascript.
      { value: 2 ** 31 - 1 },
      { value: 0 },
      isSuperAdmin,
      adminOrgs,
    );
  }
};
