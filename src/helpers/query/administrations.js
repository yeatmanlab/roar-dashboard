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

const mapAdministrations = async ({ isSuperAdmin, data, adminOrgs }) => {
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
      if (!isSuperAdmin.value) {
        assignedOrgs = filterAdminOrgs(adminOrgs.value, assignedOrgs);
      }
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
  const administrationIds = await roarfirekit.value.getAdministrations({
    testData: toValue(fetchTestData),
  });

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
