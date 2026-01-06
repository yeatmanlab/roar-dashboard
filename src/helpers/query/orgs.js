import { toValue } from 'vue';
import _intersection from 'lodash/intersection';
import _flattenDeep from 'lodash/flattenDeep';
import _isEmpty from 'lodash/isEmpty';
import _without from 'lodash/without';
import _zip from 'lodash/zip';
import _uniqBy from 'lodash/uniqBy';
import {
  batchGetDocs,
  fetchDocById,
  fetchDocumentsById,
  getAxiosInstance,
  mapFields,
  getBaseDocumentPath,
  orderByNameASC,
} from '@/helpers/query/utils';
import { ORG_TYPES, SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

export const getOrgsRequestBody = ({
  aggregationQuery,
  orderBy,
  orgNormalizedName,
  orgType,
  page,
  pageLimit,
  paginate = true,
  parentDistrict,
  parentSchool,
  select = ['id', 'name', 'tags'],
}) => {
  const requestBody = {
    structuredQuery: {
      orderBy: orderBy ?? orderByNameASC,
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

  if (orgNormalizedName) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'normalizedName' },
        op: 'EQUAL',
        value: { stringValue: orgNormalizedName },
      },
    });
  }

  if (orgType === ORG_TYPES.SCHOOLS && parentDistrict) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'districtId' },
        op: 'EQUAL',
        value: { stringValue: parentDistrict },
      },
    });
  }

  if (orgType === ORG_TYPES.CLASSES) {
    if (parentSchool) {
      filters.push({
        fieldFilter: {
          field: { fieldPath: 'schoolId' },
          op: 'EQUAL',
          value: { stringValue: parentSchool },
        },
      });
    }

    if (parentDistrict) {
      filters.push({
        fieldFilter: {
          field: { fieldPath: 'districtId' },
          op: 'EQUAL',
          value: { stringValue: parentDistrict },
        },
      });
    }
  }

  if (orgType === ORG_TYPES.GROUPS && parentDistrict) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'parentOrgId' },
        op: 'EQUAL',
        value: { stringValue: parentDistrict },
      },
    });
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

export const fetchOrgByName = async (orgType, orgNormalizedName, selectedDistrict, selectedSchool, orderBy = null) => {
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType,
    parentDistrict: ['schools', 'classes', 'groups'].includes(orgType) ? selectedDistrict?.value?.id : null,
    parentSchool: orgType === 'classes' ? selectedSchool?.value?.id : null,
    aggregationQuery: false,
    orgNormalizedName,
    paginate: false,
    select: ['id', 'name', 'normalizedName'],
    orderBy,
  });

  return axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, requestBody).then(({ data }) => mapFields(data));
};

export const orgFetcher = async (orgType, selectedDistrict, isSuperAdmin, adminOrgs, select = ['name', 'id']) => {
  const districtId = toValue(selectedDistrict) === 'any' ? null : toValue(selectedDistrict);

  if (isSuperAdmin.value) {
    const axiosInstance = getAxiosInstance();
    const requestBody = getOrgsRequestBody({
      orgType: orgType,
      parentDistrict: orgType === 'schools' ? districtId : null,
      aggregationQuery: false,
      paginate: false,
      select: select,
    });

    return axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, requestBody).then(({ data }) => mapFields(data));
  } else {
    if (orgType === 'groups') {
      const promises = (adminOrgs.value[orgType] ?? []).map((orgId) => {
        return fetchDocById(orgType, orgId, select);
      });
      const districts = await Promise.all(promises);
      return _uniqBy(districts.filter(Boolean), (district) => district.id);
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

export const orgFetchAll = async (
  activeOrgType,
  selectedDistrict,
  selectedSchool,
  orderBy,
  select = ['id', 'name', 'tags'],
  includeCreators = false,
) => {
  const districtId = selectedDistrict.value === 'any' ? null : selectedDistrict.value;

  let orgs;

  // When a specific site is selected, only fetch that one site
  if (activeOrgType.value === ORG_TYPES.DISTRICTS && districtId) {
    try {
      const district = await fetchDocById(ORG_TYPES.DISTRICTS, districtId, select);
      orgs = district ? [district] : [];
    } catch (error) {
      console.error('orgFetchAll: Error fetching district by ID:', error);
      return [];
    }
  } else {
    // Otherwise, fetch all sites (only available to super admins)
    const axiosInstance = getAxiosInstance();
    const requestBody = getOrgsRequestBody({
      aggregationQuery: false,
      orderBy: orderBy.value,
      orgType: activeOrgType.value,
      paginate: false,
      parentDistrict: districtId,
      parentSchool: selectedSchool.value,
      select,
    });

    try {
      orgs = await axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, requestBody).then(({ data }) => {
        return mapFields(data);
      });
    } catch (error) {
      console.error('orgFetchAll: Error fetching orgs:', error);
      return [];
    }
  }

  // @TODO: Add admin's name to group documents to avoid extra queries
  // Add creator data if requested
  if (includeCreators) {
    try {
      // Extract unique creator IDs
      const creatorIds = [...new Set(orgs.map((org) => org.createdBy).filter(Boolean))];

      if (creatorIds.length > 0) {
        // Fetch creator data in batch
        let creatorsData = [];
        try {
          creatorsData = await fetchDocumentsById(FIRESTORE_COLLECTIONS.USERS, creatorIds, ['displayName', 'name']);
        } catch (error) {
          console.error('orgFetchAll: Error fetching creator data from Firestore:', error);
          creatorsData = [];
        }

        // Create a map for quick lookup
        const creatorsMap = new Map();
        creatorsData.forEach((creator) => {
          creatorsMap.set(creator.id, creator);
        });

        // Add creator data to orgs
        orgs = orgs.map((org) => {
          let creatorName = '--';
          if (org.createdBy) {
            const creatorData = creatorsMap.get(org.createdBy);
            if (creatorData) {
              if (creatorData.displayName) {
                creatorName = creatorData.displayName;
              } else if (creatorData.name && creatorData.name.first && creatorData.name.last) {
                creatorName = `${creatorData.name.first} ${creatorData.name.last}`;
              }
            }
          }

          return {
            ...org,
            creatorName,
          };
        });
      }
    } catch (error) {
      console.error('orgFetchAll: Error fetching creator data:', error);
      // Continue without creator data if fetching fails
    }
  }

  return orgs;
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

export const fetchDistricts = async (districts = null) => {
  const axiosInstance = getAxiosInstance();

  // If districts is null, fetch all districts
  if (districts === null) {
    const requestBody = getOrgsRequestBody({
      orgType: ORG_TYPES.DISTRICTS,
      aggregationQuery: false,
      paginate: false,
      select: ['id', 'name', 'tags'],
    });

    return axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, requestBody).then(({ data }) => mapFields(data));
  }

  // If districts is an array of objects with siteId, fetch specific districts by ID
  if (Array.isArray(districts) && districts.length > 0) {
    const promises = districts.map((district) => {
      return fetchDocById(ORG_TYPES.DISTRICTS, district.siteId, ['id', 'name', 'tags']);
    });

    return Promise.all(promises);
  }

  // If districts is empty array or invalid, return empty array
  return Promise.resolve([]);
};

export const fetchSchools = async (districts = null) => {
  const axiosInstance = getAxiosInstance();

  // If districts is null, fetch all schools
  if (districts === null) {
    const requestBody = getOrgsRequestBody({
      orgType: ORG_TYPES.SCHOOLS,
      aggregationQuery: false,
      paginate: false,
      select: ['id', 'name', 'tags', 'districtId'],
    });

    return axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, requestBody).then(({ data }) => mapFields(data));
  }

  // If districts is an array of objects with siteId, fetch schools for those districts
  if (Array.isArray(districts) && districts.length > 0) {
    const requestBody = getOrgsRequestBody({
      orgType: ORG_TYPES.SCHOOLS,
      aggregationQuery: false,
      paginate: false,
      select: ['id', 'name', 'tags', 'districtId'],
    });

    // Add filter for districtId IN the provided district IDs
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'districtId' },
        op: 'IN',
        value: {
          arrayValue: {
            values: districts.map((id) => ({ stringValue: id })),
          },
        },
      },
    };

    return axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, requestBody).then(({ data }) => mapFields(data));
  }

  // If districts is empty array or invalid, return empty array
  return Promise.resolve([]);
};

export const fetchOrgsBySite = async (siteId = null) => {
  if (!siteId) return null;

  const axiosInstance = getAxiosInstance();
  const promises = [];

  // Fetch schools where districtId === siteId
  const schoolsRequestBody = getOrgsRequestBody({
    orgType: ORG_TYPES.SCHOOLS,
    aggregationQuery: false,
    paginate: false,
    parentDistrict: siteId,
    select: ['id'],
  });
  promises.push(
    axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, schoolsRequestBody).then(({ data }) => mapFields(data)),
  );

  // Fetch classes where districtId === siteId
  const classesRequestBody = getOrgsRequestBody({
    orgType: ORG_TYPES.CLASSES,
    aggregationQuery: false,
    paginate: false,
    parentDistrict: siteId,
    select: ['id'],
  });
  promises.push(
    axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, classesRequestBody).then(({ data }) => mapFields(data)),
  );

  // Fetch groups where parentOrgId === siteId
  const groupsRequestBody = getOrgsRequestBody({
    orgType: ORG_TYPES.GROUPS,
    aggregationQuery: false,
    paginate: false,
    parentDistrict: siteId,
    select: ['id'],
  });
  promises.push(
    axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, groupsRequestBody).then(({ data }) => mapFields(data)),
  );

  const results = await Promise.all(promises);
  return _flattenDeep(results);
};
