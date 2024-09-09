import { toValue } from 'vue';
import _chunk from 'lodash/chunk';
import _flatten from 'lodash/flatten';
import _mapValues from 'lodash/mapValues';
import _uniqBy from 'lodash/uniqBy';
import _without from 'lodash/without';
import { convertValues, getAxiosInstance, mapFields, orderByDefault } from './utils';
import { filterAdminOrgs } from '@/helpers';

export function getTitle(item, isSuperAdmin) {
  if (isSuperAdmin) {
    return item.name;
  } else {
    // Check if publicName exists, otherwise fallback to name
    return item.publicName ?? item.name;
  }
}

const getAdministrationsRequestBody = ({
  orderBy,
  aggregationQuery,
  paginate = true,
  page,
  pageLimit,
  skinnyQuery = false,
  assigningOrgCollection,
  assigningOrgIds,
  testData = false,
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

    if (skinnyQuery) {
      requestBody.structuredQuery.select = {
        fields: [{ fieldPath: 'id' }, { fieldPath: 'name' }],
      };
    } else {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: 'id' },
          { fieldPath: 'name' },
          { fieldPath: 'publicName' },
          { fieldPath: 'assessments' },
          { fieldPath: 'dateClosed' },
          { fieldPath: 'dateCreated' },
          { fieldPath: 'dateOpened' },
          { fieldPath: 'districts' },
          { fieldPath: 'schools' },
          { fieldPath: 'classes' },
          { fieldPath: 'groups' },
          { fieldPath: 'families' },
          { fieldPath: 'testData' },
        ],
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: 'administrations',
      allDescendants: false,
    },
  ];
  const filters = [];

  // If we're fetching test data, we don't need to filter by assigningOrgs as a super admin
  // This assumes that the document has a testData field that is a boolean
  if (testData === true) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'testData' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    });
  } else {
    // Else only fetch data not marked as test data
    // This assumes that the document has a testData field that is a boolean
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'testData' },
        op: 'EQUAL',
        value: { booleanValue: false },
      },
    });

    // If we're not a super admin, we need to filter by assigningOrgs
    // Non-super admin users do not have access to test data
    if (assigningOrgCollection && assigningOrgIds) {
      filters.push({
        fieldFilter: {
          field: { fieldPath: `readOrgs.${assigningOrgCollection}` },
          op: 'ARRAY_CONTAINS_ANY',
          value: {
            arrayValue: {
              values: assigningOrgIds.map((orgId) => ({ stringValue: orgId })),
            },
          },
        },
      });
    }
  }

  // If we have filters, add them to the request body
  if (filters.length > 0) {
    requestBody.structuredQuery.where =
      filters.length === 1
        ? filters[0]
        : {
            compositeFilter: {
              op: 'AND',
              filters: filters,
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

export const administrationCounter = async (orderBy, isSuperAdmin, adminOrgs) => {
  const axiosInstance = getAxiosInstance();
  if (isSuperAdmin.value) {
    const requestBody = getAdministrationsRequestBody({
      aggregationQuery: true,
      orderBy: orderBy.value,
      paginate: false,
      skinnyQuery: true,
    });
    console.log(`Fetching count for administrations`);
    return axiosInstance.post(':runAggregationQuery', requestBody).then(({ data }) => {
      return Number(convertValues(data[0].result?.aggregateFields?.count));
    });
  } else {
    const promises = [];
    // Iterate through each adminOrg type
    for (const [orgType, orgIds] of Object.entries(adminOrgs.value)) {
      // Then chunk those arrays into chunks of 10
      if ((orgIds ?? []).length > 0) {
        const requestBodies = _chunk(orgIds, 10).map((orgChunk) =>
          getAdministrationsRequestBody({
            aggregationQuery: false,
            paginate: false,
            skinnyQuery: true,
            assigningOrgCollection: orgType,
            assigningOrgIds: orgChunk,
          }),
        );

        promises.push(
          requestBodies.map((requestBody) =>
            axiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
              return mapFields(data);
            }),
          ),
        );
      }
    }

    const flattened = _flatten(await Promise.all(_flatten(promises)));
    const orderField = (orderBy?.value ?? orderByDefault)[0].field.fieldPath;
    const administrations = _uniqBy(flattened, 'id').filter((a) => a[orderField] !== undefined);
    return administrations.length;
  }
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

export const administrationPageFetcher = async (
  orderBy,
  pageLimit,
  page,
  isSuperAdmin,
  adminOrgs,
  exhaustiveAdminOrgs,
  fetchTestData = false,
) => {
  const axiosInstance = getAxiosInstance();
  if (isSuperAdmin.value) {
    const requestBody = getAdministrationsRequestBody({
      aggregationQuery: false,
      orderBy: orderBy.value,
      paginate: true,
      page: page.value,
      skinnyQuery: false,
      pageLimit: pageLimit.value,
      testData: toValue(fetchTestData),
    });
    console.log(`Fetching page ${page.value} for administrations`);
    return axiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
      return mapAdministrations({ isSuperAdmin, data, adminOrgs });
    });
  } else {
    const promises = [];
    // Iterate through each adminOrg type
    for (const [orgType, orgIds] of Object.entries(adminOrgs.value)) {
      // Then chunk those arrays into chunks of 10
      if ((orgIds ?? []).length > 0) {
        const requestBodies = _chunk(orgIds, 10).map((orgChunk) =>
          getAdministrationsRequestBody({
            aggregationQuery: false,
            paginate: false,
            skinnyQuery: false,
            assigningOrgCollection: orgType,
            assigningOrgIds: orgChunk,
          }),
        );
        // Map all of those request bodies into axios promises
        promises.push(
          requestBodies.map((requestBody) =>
            axiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
              return mapAdministrations({ isSuperAdmin, data, adminOrgs: exhaustiveAdminOrgs });
            }),
          ),
        );
      }
    }

    const orderField = (orderBy?.value ?? orderByDefault)[0].field.fieldPath;
    const orderDirection = (orderBy?.value ?? orderByDefault)[0].direction;
    const flattened = _flatten(await Promise.all(_flatten(promises)));
    const administrations = _uniqBy(flattened, 'id')
      .filter((a) => a[orderField] !== undefined)
      .sort((a, b) => {
        if (orderDirection === 'ASCENDING') return 2 * +(a[orderField] > b[orderField]) - 1;
        if (orderDirection === 'DESCENDING') return 2 * +(b[orderField] > a[orderField]) - 1;
        return 0;
      });
    return administrations.slice(page.value * pageLimit.value, (page.value + 1) * pageLimit.value);
  }
};
