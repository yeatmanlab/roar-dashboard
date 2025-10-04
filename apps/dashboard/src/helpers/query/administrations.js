import { toValue } from 'vue';
import _chunk from 'lodash/chunk';
import _last from 'lodash/last';
import _mapValues from 'lodash/mapValues';
import _without from 'lodash/without';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { convertValues, getAxiosInstance, orderByDefault } from './utils';
import { filterAdminOrgs } from '@/helpers';

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
    const { data } = await axiosInstance.post(':batchGet', {
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

/**
 * Get assigned orgs for administrations, handling both old and new formats
 * @param {Array} administrationData - Array of administration documents
 * @returns {Object} Object mapping administration IDs to their assigned orgs
 */
const getAdministrationOrgs = async (administrationData) => {
  const axiosInstance = getAxiosInstance();
  const documentPrefix = axiosInstance.defaults.baseURL.replace('https://firestore.googleapis.com/v1/', '');
  const result = {};

  // Separate old and new format administrations
  const oldFormatAdmins = [];
  const newFormatAdmins = [];

  administrationData.forEach(({ data: admin }) => {
    if (admin.formatVersion === 2) {
      newFormatAdmins.push(admin);
    } else {
      // Old format or no formatVersion (defaults to old format)
      oldFormatAdmins.push(admin);
    }
  });

  // Handle old format administrations (read from arrays in main document)
  oldFormatAdmins.forEach((admin) => {
    result[admin.id] = {
      districts: admin.districts || [],
      schools: admin.schools || [],
      classes: admin.classes || [],
      groups: admin.groups || [],
      families: admin.families || [],
    };
  });

  // Handle new format administrations (read from subcollections)
  if (newFormatAdmins.length > 0) {
    const subcollectionOrgs = await getOrgsFromSubcollections(newFormatAdmins, axiosInstance, documentPrefix);
    Object.assign(result, subcollectionOrgs);
  }

  return result;
};

/**
 * Get orgs from subcollections for new format administrations
 * @param {Array} administrations - Array of new format administration documents
 * @param {Object} axiosInstance - Axios instance for API calls
 * @param {string} documentPrefix - Document path prefix
 * @returns {Object} Object mapping administration IDs to their assigned orgs
 */
const getOrgsFromSubcollections = async (administrations, axiosInstance, documentPrefix) => {
  const result = {};

  // Initialize empty org structures for all administrations
  administrations.forEach((admin) => {
    result[admin.id] = {
      districts: [],
      schools: [],
      classes: [],
      groups: [],
      families: [],
    };
  });

  // Batch query all assignedOrgs subcollections
  const subcollectionPaths = administrations.map(
    (admin) => `${documentPrefix}/administrations/${admin.id}/assignedOrgs`,
  );

  try {
    // Query each subcollection
    for (const subcollectionPath of subcollectionPaths) {
      const adminId = subcollectionPath.split('/').slice(-2, -1)[0]; // Extract admin ID from path

      const { data } = await axiosInstance.post(':runQuery', {
        parent: subcollectionPath.replace('/assignedOrgs', ''),
        structuredQuery: {
          from: [{ collectionId: 'assignedOrgs' }],
          select: {
            fields: [{ fieldPath: 'orgType' }, { fieldPath: 'orgId' }],
          },
        },
      });

      // Process the results
      if (data && Array.isArray(data)) {
        data.forEach((item) => {
          if (item.document && item.document.fields) {
            const orgType = convertValues(item.document.fields.orgType);
            const orgId = convertValues(item.document.fields.orgId);

            if (orgType && orgId && result[adminId] && result[adminId][orgType]) {
              result[adminId][orgType].push(orgId);
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('Error fetching subcollection orgs:', error);
    // Return empty org structures on error
  }

  return result;
};

const mapAdministrations = async ({ isSuperAdmin, data, adminOrgs }) => {
  // Get assigned orgs for all administrations (handling both old and new formats)
  const administrationOrgs = await getAdministrationOrgs(data);

  // First format the administration documents
  const administrationData = data
    .map((a) => a.data)
    .map((a) => {
      let assignedOrgs = administrationOrgs[a.id] || {
        districts: [],
        schools: [],
        classes: [],
        groups: [],
        families: [],
      };

      if (!isSuperAdmin.value) {
        assignedOrgs = filterAdminOrgs(adminOrgs.value, assignedOrgs);
      }
      return {
        id: a.id,
        name: a.name,
        publicName: a?.publicName,
        dates: {
          start: a.dateOpened,
          end: a.dateClosed,
          created: a.dateCreated,
        },
        assessments: a.assessments,
        assignedOrgs,
        // If testData is not defined, default to false when mapping
        testData: a.testData ?? false,
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

export const administrationPageFetcher = async (isSuperAdmin, exhaustiveAdminOrgs, fetchTestData = false, orderBy) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  const administrationIds = await roarfirekit.value.getAdministrations({ testData: toValue(fetchTestData) });

  const axiosInstance = getAxiosInstance();
  const documentPrefix = axiosInstance.defaults.baseURL.replace('https://firestore.googleapis.com/v1/', '');
  const documents = administrationIds.map((id) => `${documentPrefix}/administrations/${id}`);

  const { data } = await axiosInstance.post(':batchGet', { documents });

  const administrationData = _without(
    data.map(({ found }) => {
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

  const administrations = await mapAdministrations({
    isSuperAdmin,
    data: administrationData,
    adminOrgs: exhaustiveAdminOrgs,
  });

  const orderField = (orderBy?.value ?? orderByDefault)[0].field.fieldPath;
  const orderDirection = (orderBy?.value ?? orderByDefault)[0].direction;
  const sortedAdministrations = administrations
    .filter((a) => a[orderField] !== undefined)
    .sort((a, b) => {
      if (orderDirection === 'ASCENDING') return 2 * +(a[orderField] > b[orderField]) - 1;
      if (orderDirection === 'DESCENDING') return 2 * +(b[orderField] > a[orderField]) - 1;
      return 0;
    });

  return sortedAdministrations;
};
