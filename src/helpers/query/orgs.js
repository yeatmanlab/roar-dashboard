import { toValue } from 'vue';
import _intersection from 'lodash/intersection';
import _uniq from 'lodash/uniq';
import _flattenDeep from 'lodash/flattenDeep';
import _isEmpty from 'lodash/isEmpty';
import _without from 'lodash/without';
import _zip from 'lodash/zip';
import {
  batchGetDocs,
  convertValues,
  fetchDocById,
  getAxiosInstance,
  mapFields,
  orderByDefault,
} from '@/helpers/query/utils';
import { ORG_TYPES, SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

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
    'id',
    'name',
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

  const filters = [];

  if (orgName && !(parentDistrict || parentSchool)) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'name' },
        op: 'EQUAL',
        value: { stringValue: orgName },
      },
    });
  } else if ( (orgType === 'schools' && parentDistrict) || (orgType === 'classes' && parentDistrict && !parentSchool)) {
    if (orgName) {
      filters.push(
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
      filters.push({
        fieldFilter: {
          field: { fieldPath: 'districtId' },
          op: 'EQUAL',
          value: { stringValue: parentDistrict },
        },
      });
    }
  } else if (orgType === 'classes' && parentSchool) {
    if (orgName) {
      filters.push(
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
      filters.push({
        fieldFilter: {
          field: { fieldPath: 'schoolId' },
          op: 'EQUAL',
          value: { stringValue: parentSchool },
        },
      });
    }
  }

  if (filters.length > 0) {
    requestBody.structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters,
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
    select: ['id'],
  });

  return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
};

export const orgFetcher = async (
  orgType,
  selectedDistrict,
  isSuperAdmin,
  adminOrgs,
  select = ['name', 'id', 'tags', 'currentActivationCode'],
) => {
  const districtId = toValue(selectedDistrict);

  if (isSuperAdmin.value) {
    const axiosInstance = getAxiosInstance();
    const requestBody = getOrgsRequestBody({
      orgType: orgType,
      parentDistrict: orgType === 'schools' ? districtId : null,
      aggregationQuery: false,
      paginate: false,
      select: select,
    });

    if (orgType === 'districts') {
      console.log(`Fetching ${orgType}`);
    } else if (orgType === 'schools') {
      console.log(`Fetching ${orgType} for ${districtId}`);
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
      const districtDoc = await fetchDocById('districts', districtId, ['schools']);
      if ((adminOrgs.value['districts'] ?? []).includes(districtId)) {
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

  if (isSuperAdmin.value) {
    return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
  } else {
    if (activeOrgType.value === 'schools' && (adminOrgs.value['districts'] ?? []).includes(selectedDistrict.value)) {
      const query = axiosInstance.post(':runQuery', requestBody).then(({ data }) => {
        return mapFields(data);
      });
      return query
    } else if (
      activeOrgType.value === 'classes' &&
      ((adminOrgs.value['schools'] ?? []).includes(selectedSchool.value) ||
        (adminOrgs.value['districts'] ?? []).includes(selectedDistrict.value))
    ) {
      return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
    }

    const orgIds = adminOrgs.value[activeOrgType.value] ?? [];
    // @TODO: Refactor to a single query for all orgs instead of multiple parallel queries.
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
    try {
      return await axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
    } catch (error) {
      console.error('orgFetchAll: Error fetching all orgs for super admin:', error);
      return [];
    }
  } else {
    try {
      return await orgPageFetcher(
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
    } catch (error) {
      console.error('orgFetchAll: Error fetching all orgs for non-super admin:', error);
      return [];
    }
  }
};

/**
 * Fetches Districts Schools Groups Families (DSGF) Org data for a given administration.
 *
 * @param {String} administrationId – The ID of the administration to fetch DSGF orgs data for.
 * @param {Object} assignedOrgs – The orgs assigned to the administration being processed.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of org objects.
 */
export const fetchTreeOrgs = async (administrationId, assignedOrgs) => {
  const orgTypes = [ORG_TYPES.DISTRICTS, ORG_TYPES.SCHOOLS, ORG_TYPES.GROUPS, ORG_TYPES.FAMILIES];

  const orgPaths = _flattenDeep(
    orgTypes.map((orgType) => (assignedOrgs[orgType] ?? []).map((orgId) => `${orgType}/${orgId}`) ?? []),
  );

  const statsPaths = _flattenDeep(
    orgTypes.map(
      (orgType) =>
        (assignedOrgs[orgType] ?? []).map((orgId) => `administrations/${administrationId}/stats/${orgId}`) ?? [],
    ),
  );

  const promises = [
    batchGetDocs(orgPaths, ['name', 'schools', 'classes', 'archivedSchools', 'archivedClasses', 'districtId']),
    batchGetDocs(statsPaths),
  ];

  const [orgDocs, statsDocs] = await Promise.all(promises);

  const dsgfOrgs = _without(
    _zip(orgDocs, statsDocs).map(([orgDoc, stats], index) => {
      if (!orgDoc || _isEmpty(orgDoc)) {
        return undefined;
      }
      const { classes, schools, archivedSchools, archivedClasses, collection, ...nodeData } = orgDoc;
      const node = {
        key: String(index),
        data: {
          orgType: SINGULAR_ORG_TYPES[collection.toUpperCase()],
          schools,
          classes,
          archivedSchools,
          archivedClasses,
          stats,
          ...nodeData,
        },
      };
      if (classes || archivedClasses)
        node.children = [...(classes ?? []), ...(archivedClasses ?? [])].map((classId) => {
          return {
            key: `${node.key}-${classId}`,
            data: {
              orgType: SINGULAR_ORG_TYPES.CLASSES,
              id: classId,
            },
          };
        });
      return node;
    }),
    undefined,
  );

  const districtIds = dsgfOrgs
    .filter((node) => node.data.orgType === SINGULAR_ORG_TYPES.DISTRICTS)
    .map((node) => node.data.id);

  const dependentSchoolIds = _flattenDeep(
    dsgfOrgs.map((node) => [...(node.data.schools ?? []), ...(node.data.archivedSchools ?? [])]),
  );
  const independentSchoolIds =
    dsgfOrgs.length > 0 ? _without(assignedOrgs.schools, ...dependentSchoolIds) : assignedOrgs.schools;
  const dependentClassIds = _flattenDeep(
    dsgfOrgs.map((node) => [...(node.data.classes ?? []), ...(node.data.archivedClasses ?? [])]),
  );
  const independentClassIds =
    dsgfOrgs.length > 0 ? _without(assignedOrgs.classes, ...dependentClassIds) : assignedOrgs.classes;

  const independentSchools = (dsgfOrgs ?? []).filter((node) => {
    return node.data.orgType === SINGULAR_ORG_TYPES.SCHOOLS && independentSchoolIds.includes(node.data.id);
  });

  const dependentSchools = (dsgfOrgs ?? []).filter((node) => {
    return node.data.orgType === SINGULAR_ORG_TYPES.SCHOOLS && !independentSchoolIds.includes(node.data.id);
  });

  const independentClassPaths = independentClassIds.map((classId) => `classes/${classId}`);
  const independentClassStatPaths = independentClassIds.map(
    (classId) => `administrations/${administrationId}/stats/${classId}`,
  );

  const classPromises = [
    batchGetDocs(independentClassPaths, ['name', 'schoolId', 'districtId']),
    batchGetDocs(independentClassStatPaths),
  ];

  const [classDocs, classStats] = await Promise.all(classPromises);

  let independentClasses = _without(
    _zip(classDocs, classStats).map(([orgDoc, stats], index) => {
      const { collection = FIRESTORE_COLLECTIONS.CLASSES, ...nodeData } = orgDoc ?? {};

      if (_isEmpty(nodeData)) return undefined;

      const node = {
        key: String(dsgfOrgs.length + index),
        data: {
          orgType: SINGULAR_ORG_TYPES[collection.toUpperCase()],
          ...(stats && { stats }),
          ...nodeData,
        },
      };
      return node;
    }),
    undefined,
  );

  // These are classes that are directly under a district, without a school
  // They were eroneously categorized as independent classes but now we need
  // to remove them from the independent classes array
  const directReportClasses = independentClasses.filter((node) => districtIds.includes(node.data.districtId));
  independentClasses = independentClasses.filter((node) => !districtIds.includes(node.data.districtId));

  const treeTableOrgs = dsgfOrgs.filter((node) => node.data.orgType === SINGULAR_ORG_TYPES.DISTRICTS);
  treeTableOrgs.push(...independentSchools);

  for (const school of dependentSchools) {
    const districtId = school.data.districtId;
    const districtIndex = treeTableOrgs.findIndex((node) => node.data.id === districtId);
    if (districtIndex !== -1) {
      if (treeTableOrgs[districtIndex].children === undefined) {
        treeTableOrgs[districtIndex].children = [
          {
            ...school,
            key: `${treeTableOrgs[districtIndex].key}-${school.key}`,
          },
        ];
      } else {
        treeTableOrgs[districtIndex].children.push(school);
      }
    } else {
      treeTableOrgs.push(school);
    }
  }

  for (const _class of directReportClasses) {
    const districtId = _class.data.districtId;
    const districtIndex = treeTableOrgs.findIndex((node) => node.data.id === districtId);
    if (districtIndex !== -1) {
      const directReportSchoolKey = `${treeTableOrgs[districtIndex].key}-9999`;
      const directReportSchool = {
        key: directReportSchoolKey,
        data: {
          orgType: SINGULAR_ORG_TYPES.SCHOOLS,
          orgId: '9999',
          name: 'Direct Report Classes',
        },
        children: [
          {
            ..._class,
            key: `${directReportSchoolKey}-${_class.key}`,
          },
        ],
      };
      if (treeTableOrgs[districtIndex].children === undefined) {
        treeTableOrgs[districtIndex].children = [directReportSchool];
      } else {
        const schoolIndex = treeTableOrgs[districtIndex].children.findIndex(
          (node) => node.key === directReportSchoolKey,
        );
        if (schoolIndex === -1) {
          treeTableOrgs[districtIndex].children.push(directReportSchool);
        } else {
          treeTableOrgs[districtIndex].children[schoolIndex].children.push(_class);
        }
      }
    } else {
      treeTableOrgs.push(_class);
    }
  }

  treeTableOrgs.push(...(independentClasses ?? []));
  treeTableOrgs.push(...dsgfOrgs.filter((node) => node.data.orgType === SINGULAR_ORG_TYPES.GROUPS));
  treeTableOrgs.push(...dsgfOrgs.filter((node) => node.data.orgType === SINGULAR_ORG_TYPES.FAMILIES));

  (treeTableOrgs ?? []).forEach((node) => {
    // Sort the schools by existance of stats then alphabetically
    if (node.children) {
      node.children.sort((a, b) => {
        if (!a.data.stats) return 1;
        if (!b.data.stats) return -1;
        return a.data.name.localeCompare(b.data.name);
      });
    }
  });

  return treeTableOrgs;
};
