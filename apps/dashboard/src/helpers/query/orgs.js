import { toValue, unref } from 'vue';
import { storeToRefs } from 'pinia';
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
import { useAuthStore } from '@/store/auth';
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
    'parentOrgId',
    'parentOrgType',
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
  // N.B. We use unref here rather than toValue until we bump Vue to 3.3+.
  // The only difference in functionality is that unref does not handle getters.
  const activeOrgTypeValue = unref(activeOrgType);
  const selectedDistrictId = unref(selectedDistrict);
  const selectedSchoolId = unref(selectedSchool);

  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: activeOrgTypeValue,
    parentDistrict: selectedDistrictId,
    parentSchool: selectedSchoolId,
    aggregationQuery: false,
    orderBy: unref(orderBy),
    pageLimit: unref(pageLimit),
    paginate: true,
    page: unref(page),
  });

  if (isSuperAdmin.value) {
    return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
  } else {
    if (activeOrgTypeValue === 'schools' && (adminOrgs.value['districts'] ?? []).includes(selectedDistrictId)) {
      return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
    } else if (
      activeOrgTypeValue === 'classes' &&
      ((adminOrgs.value['schools'] ?? []).includes(selectedSchoolId) ||
        (adminOrgs.value['districts'] ?? []).includes(selectedDistrictId))
    ) {
      return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
    }

    const orgIds = adminOrgs.value[activeOrgTypeValue] ?? [];
    // @TODO: Refactor to a single query for all orgs instead of multiple parallel queries.
    const promises = orgIds.map((orgId) => fetchDocById(activeOrgTypeValue, orgId));
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
  // N.B. We use unref here rather than toValue until we bump Vue to 3.3+.
  // The only difference in functionality is that unref does not handle getters.
  const axiosInstance = getAxiosInstance();
  const requestBody = getOrgsRequestBody({
    orgType: unref(activeOrgType),
    parentDistrict: unref(selectedDistrict),
    parentSchool: unref(selectedSchool),
    aggregationQuery: false,
    orderBy: unref(orderBy),
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

/**
 * Fetches Districts Schools Groups Families (DSGF) Org data for a given administration.
 *
 * @param {String} administrationId – The ID of the administration to fetch DSGF orgs data for.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of org objects.
 */
export const fetchTreeOrgs = async (administrationId) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);

  // Fetch all org data and stats for the administration
  const { data: allOrgData } = await roarfirekit.value.getAdministrationOrgsAndStats(administrationId);

  console.log('allOrgData from getAdministrationOrgsAndStats', allOrgData);

  // Build the node tree
  const nodeMap = new Map();
  console.log('nodeMap 1', nodeMap);
  let nodeIndex = 0;

  // First pass: Create nodes for all orgs
  allOrgData.forEach((org) => {
    console.log('processing org', org);
    const { orgId, name, orgType, stats, hasChildren } = org;

    const node = {
      key: String(nodeIndex++),
      data: {
        id: orgId,
        name,
        orgType: SINGULAR_ORG_TYPES[orgType.toUpperCase()],
        stats,
        ...org,
      },
    };

    // Add placeholder child if hasChildren is true
    if (hasChildren) {
      node.children = [
        {
          key: `${node.key}-placeholder`,
          data: {
            name: 'Loading...',
            isPlaceholder: true,
          },
        },
      ];
    }

    nodeMap.set(orgId, node);
  });

  console.log('nodeMap', nodeMap);

  // Second pass: Build the hierarchy
  const treeTableOrgs = [];
  const processedOrgs = new Set();

  allOrgData.forEach((org) => {
    const { orgId, orgType } = org;
    const node = nodeMap.get(orgId);

    if (!node || processedOrgs.has(orgId)) return;

    // Determine if this org should be a top-level node
    const isTopLevel =
      orgType === 'district' ||
      orgType === 'group' ||
      orgType === 'family' ||
      (orgType === 'school' && !org.districtId) ||
      (orgType === 'class' && !org.schoolId && !org.districtId);

    if (isTopLevel) {
      treeTableOrgs.push(node);
      processedOrgs.add(orgId);
    } else if (orgType === 'school' && org.districtId) {
      // School belongs to a district
      const parentNode = nodeMap.get(org.districtId);
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        } else if (parentNode.children[0]?.data?.isPlaceholder) {
          // Remove placeholder
          parentNode.children = [];
        }
        parentNode.children.push({
          ...node,
          key: `${parentNode.key}-${node.key}`,
        });
        processedOrgs.add(orgId);
      } else {
        // Parent not found, add as top-level
        treeTableOrgs.push(node);
        processedOrgs.add(orgId);
      }
    } else if (orgType === 'class') {
      // Class belongs to a school or district
      const parentId = org.schoolId || org.districtId;
      const parentNode = nodeMap.get(parentId);

      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = [];
        } else if (parentNode.children[0]?.data?.isPlaceholder) {
          // Remove placeholder
          parentNode.children = [];
        }

        // If class is directly under district, create "Direct Report Classes" grouping
        if (org.districtId && !org.schoolId) {
          const directReportSchoolKey = `${parentNode.key}-direct-report`;
          let directReportSchool = parentNode.children.find((child) => child.key === directReportSchoolKey);

          if (!directReportSchool) {
            directReportSchool = {
              key: directReportSchoolKey,
              data: {
                orgType: SINGULAR_ORG_TYPES.SCHOOLS,
                id: 'direct-report',
                name: 'Direct Report Classes',
              },
              children: [],
            };
            parentNode.children.push(directReportSchool);
          }

          directReportSchool.children.push({
            ...node,
            key: `${directReportSchoolKey}-${node.key}`,
          });
        } else {
          parentNode.children.push({
            ...node,
            key: `${parentNode.key}-${node.key}`,
          });
        }
        processedOrgs.add(orgId);
      } else {
        // Parent not found, add as top-level
        treeTableOrgs.push(node);
        processedOrgs.add(orgId);
      }
    }
  });

  // Sort children by stats existence and then alphabetically
  treeTableOrgs.forEach((node) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (!a.data.stats) return 1;
        if (!b.data.stats) return -1;
        return (a.data.name || '').localeCompare(b.data.name || '');
      });

      // Recursively sort nested children
      node.children.forEach((child) => {
        if (child.children) {
          child.children.sort((a, b) => {
            if (!a.data.stats) return 1;
            if (!b.data.stats) return -1;
            return (a.data.name || '').localeCompare(b.data.name || '');
          });
        }
      });
    }
  });

  console.log('treeTableOrgs', treeTableOrgs);

  return treeTableOrgs;
};

/**
 * Fetches minimal orgs for a given administration
 */
export const getMinimalOrgs = async (administrationId, assignedOrgs) => {};

/**
 * Fetches children orgs for a given parent org. Will only return orgs that are assigned to the administration.
 * NOTE: may not need to take in administrationId, if the parentOrg is assigned to the administration, then the children will be assigned as well.
 *
 * @param {*} administrationId
 * @param {*} parentOrgId
 * @param {*} parentOrgType
 */
export const getChildrenOrgs = async (administrationId, parentOrgId, parentOrgType) => {};

export const formatTreeTableOrgs = (orgs) => {};
