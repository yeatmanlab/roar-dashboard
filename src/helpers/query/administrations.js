import { toValue } from 'vue';
import _chunk from 'lodash/chunk';
import _last from 'lodash/last';
import _mapValues from 'lodash/mapValues';
import _without from 'lodash/without';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { AUTH_USER_TYPE } from '@/constants/auth';
import { convertValues, getAxiosInstance, getBaseDocumentPath, orderByDefault } from './utils';
import { FIRESTORE_DATABASES } from '@/constants/firebase';
import { ROLES } from '@/constants/roles';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { logger } from '@/logger';
import { fetchOrgsBySite } from './orgs';

export function getTitle(item, isSuperAdmin) {
  if (isSuperAdmin) {
    return item.name;
  } else {
    // Check if publicName exists, otherwise fallback to name
    return item.publicName ?? item.name;
  }
}

const processBatchStats = async (axiosInstance, statsPaths, batchSize = 5) => {
  const batchStatsDocs = [];
  const statsPathChunks = _chunk(statsPaths, batchSize);
  for (const batch of statsPathChunks) {
    const { data } = await axiosInstance.post(`${getBaseDocumentPath()}:batchGet`, {
      documents: batch,
    });

    const processedBatch = _without(
      data.map(({ found }) => {
        if (found) {
          return {
            name: found.name,
            data: _mapValues(found.fields, (value) => convertValues(value)),
          };
        }
        return undefined;
      }),
      undefined,
    );

    batchStatsDocs.push(...processedBatch);
  }

  return batchStatsDocs;
};

// TODO: Remove this function. Fields that we want should be passed into the query, not filtered from the whole data of the document on the client side.
// Netowrk call should be done in the query function, not here.
const mapAdministrations = async (data) => {
  // First format the administration documents
  const administrationData = data
    .map((a) => a.data)
    .map((a) => {
      let assignedOrgs = {
        districts: a.districts,
        schools: a.schools,
        classes: a.classes,
        groups: a.groups,
        families: a.families,
      };

      return {
        id: a.id,
        name: a.name,
        publicName: a.publicName,
        dates: {
          start: a.dateOpened,
          end: a.dateClosed,
          created: a.dateCreated,
        },
        assessments: a.assessments,
        assignedOrgs,
        // If testData is not defined, default to false when mapping
        testData: a.testData ?? false,
        creatorName: a.creatorName,
      };
    });

  // Create a list of all the stats document paths we need to get
  const statsPaths = data
    // First filter out any missing administration documents
    .filter((item) => item.name !== undefined)
    // Then map to the total stats document
    .map(({ name }) => `${name}/stats/total`);

  const axiosInstance = getAxiosInstance();
  const batchStatsDocs = await processBatchStats(axiosInstance, statsPaths);

  const administrations = administrationData?.map((administration) => {
    const thisAdminStats = batchStatsDocs.find((statsDoc) => statsDoc.name.includes(administration.id));
    return {
      ...administration,
      stats: { total: thisAdminStats?.data },
    };
  });

  return administrations;
};

export const administrationPageFetcher = async (selectedDistrictId, fetchTestData = false, orderBy) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);

  const siteId =
    selectedDistrictId.value.trim() && selectedDistrictId.value !== 'any' ? selectedDistrictId.value : null;

  let orgs = [];

  const administrationIds = await roarfirekit.value.getAdministrations({
    testData: toValue(fetchTestData),
  });

  const axiosInstance = getAxiosInstance();
  const documents = administrationIds.map((id) => `${getBaseDocumentPath()}/administrations/${id}`);

  let data = [];

  try {
    data = await axiosInstance.post(`${getBaseDocumentPath()}:batchGet`, { documents });
  } catch (error) {
    console.error('Error fetching administration data:', error);
    return { sortedAdministrations: [], administrations: [] };
  }

  const administrationData = _without(
    data.data.map(({ found }) => {
      if (found) {
        return {
          name: found.name,
          data: {
            id: _last(found.name.split('/')),
            ..._mapValues(found.fields, (value) => convertValues(value)),
          },
        };
      }
      return undefined;
    }),
    undefined,
  );

  let administrations = await mapAdministrations(administrationData);

  if (siteId) {
    orgs = await fetchOrgsBySite(siteId);
    orgs.push({ id: siteId });

    administrations = administrations.filter((administration) => {
      return orgs.some(
        (org) =>
          administration.assignedOrgs.districts.includes(org.id) ||
          administration.assignedOrgs.schools.includes(org.id) ||
          administration.assignedOrgs.classes.includes(org.id) ||
          administration.assignedOrgs.groups.includes(org.id),
      );
    });
  }

  const orderField = (orderBy?.value ?? orderByDefault)[0].field.fieldPath;
  const orderDirection = (orderBy?.value ?? orderByDefault)[0].direction;
  const sortedAdministrations = administrations
    .filter((a) => a[orderField] !== undefined)
    .sort((a, b) => {
      if (orderDirection === 'ASCENDING') return 2 * +(a[orderField] > b[orderField]) - 1;
      if (orderDirection === 'DESCENDING') return 2 * +(b[orderField] > a[orderField]) - 1;
      return 0;
    });

  return { sortedAdministrations, administrations };
};

/**
 * Returns administrations that are assigned to a specific organization.
 *
 * @param {String} orgId – The organization ID to filter administrations by.
 * @param {String} orgType – The organization type (districts, schools, classes, groups).
 * @param {Array} administrations – The list of all administrations to filter.
 * @returns {Array} – An array of administrations assigned to the specified organization.
 */
export const getAdministrationsByOrg = (orgId, orgType, administrations) => {
  if (!administrations || !orgId || !orgType) {
    return [];
  }

  return administrations.filter((administration) => {
    const assignedOrgs = administration.assignedOrgs?.[orgType] || [];
    return assignedOrgs.includes(orgId);
  });
};

export const fetchAdminsBySite = async (siteId, siteName, db = FIRESTORE_DATABASES.ADMIN) => {
  const axiosInstance = getAxiosInstance(db);

  let requestBody;

  if (siteId.value === 'any') {
    requestBody = {
      structuredQuery: {
        from: [{ collectionId: FIRESTORE_COLLECTIONS.USERS }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userType' },
            op: 'EQUAL',
            value: { stringValue: AUTH_USER_TYPE.ADMIN },
          },
        },
      },
    };
  } else {
    const filters = [
      {
        fieldFilter: {
          field: { fieldPath: 'roles' },
          op: 'ARRAY_CONTAINS',
          value: {
            mapValue: {
              fields: {
                siteId: { stringValue: 'any' },
                role: { stringValue: ROLES.SUPER_ADMIN },
              },
            },
          },
        },
      },
    ];

    if (siteName) {
      filters.push(
        {
          fieldFilter: {
            field: { fieldPath: 'roles' },
            op: 'ARRAY_CONTAINS',
            value: {
              mapValue: {
                fields: {
                  siteId: { stringValue: siteId.value },
                  siteName: { stringValue: siteName.value },
                  role: { stringValue: ROLES.ADMIN },
                },
              },
            },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: 'roles' },
            op: 'ARRAY_CONTAINS',
            value: {
              mapValue: {
                fields: {
                  siteId: { stringValue: siteId.value },
                  siteName: { stringValue: siteName.value },
                  role: { stringValue: ROLES.SITE_ADMIN },
                },
              },
            },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath: 'roles' },
            op: 'ARRAY_CONTAINS',
            value: {
              mapValue: {
                fields: {
                  siteId: { stringValue: siteId.value },
                  siteName: { stringValue: siteName.value },
                  role: { stringValue: ROLES.RESEARCH_ASSISTANT },
                },
              },
            },
          },
        },
      );
    }

    requestBody = {
      structuredQuery: {
        from: [{ collectionId: FIRESTORE_COLLECTIONS.USERS }],
        where: {
          compositeFilter: {
            op: 'OR',
            filters,
          },
        },
      },
    };
  }

  try {
    const response = await axiosInstance.post(`${getBaseDocumentPath()}:runQuery`, requestBody);

    return response.data
      .filter((user) => user.document)
      .map((user) => {
        const doc = user.document;

        return {
          id: doc.name.split('/').pop(),
          ..._mapValues(doc.fields, (value) => convertValues(value)),
        };
      });
  } catch (error) {
    console.error('fetchAdminsBySite: Error fetching admins by siteId:', error);
    logger.error(error, { context: { function: 'fetchAdminsBySite', siteId, siteName } });
    throw error;
  }
};
