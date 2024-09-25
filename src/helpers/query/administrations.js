import _chunk from 'lodash/chunk';
import _mapValues from 'lodash/mapValues';
import _without from 'lodash/without';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { convertValues, getAxiosInstance, mapFields } from './utils';
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
  const administrationData = mapFields(data).map((a) => {
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
    .filter((item) => item.document !== undefined)
    // Then map to the total stats document
    .map(({ document }) => `${document.name}/stats/total`);

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

export const administrationPageFetcher = async (isSuperAdmin, exhaustiveAdminOrgs, fetchTestData = false) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  const administrations = roarfirekit.value.getAdministrations({ testData: fetchTestData });

  return mapAdministrations({ isSuperAdmin, data: administrations, adminOrgs: exhaustiveAdminOrgs });
};
