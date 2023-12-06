import _chunk from 'lodash/chunk';
import _flatten from 'lodash/flatten';
import _mapValues from 'lodash/mapValues';
import _uniqBy from 'lodash/uniqBy';
import _without from 'lodash/without';
import { convertValues, getAxiosInstance, mapFields, orderByDefault } from './utils';
import { filterAdminOrgs } from '@/helpers';

const getAdministrationsRequestBody = ({
  orderBy,
  aggregationQuery,
  paginate = true,
  page,
  pageLimit,
  skinnyQuery = false,
  assigningOrgCollection,
  assigningOrgIds,
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
          { fieldPath: 'assessments' },
          { fieldPath: 'dateClosed' },
          { fieldPath: 'dateCreated' },
          { fieldPath: 'dateOpened' },
          { fieldPath: 'districts' },
          { fieldPath: 'schools' },
          { fieldPath: 'classes' },
          { fieldPath: 'groups' },
          { fieldPath: 'families' },
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

  if (assigningOrgCollection && assigningOrgIds) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: `readOrgs.${assigningOrgCollection}` },
        op: 'ARRAY_CONTAINS_ANY',
        value: {
          arrayValue: {
            values: assigningOrgIds.map((orgId) => ({ stringValue: orgId })),
          },
        },
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
  const axiosInstance = getAxiosInstance();
  const administrationData = mapFields(data);

  const statsPaths = data
    .filter((item) => item.document !== undefined)
    .map(({ document }) => `${document.name}/stats/completion`);
  const batchStatsDocs = await axiosInstance
    .post(':batchGet', {
      documents: statsPaths,
    })
    .then(({ data }) => {
      return _without(
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
    });

  const administrations = administrationData.map((administration) => {
    const stats = batchStatsDocs.find((statsDoc) => statsDoc.name.includes(administration.id));
    return {
      ...administration,
      stats: stats?.data,
    };
  });

  return administrations.map((a) => {
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
      stats: a.stats,
      dates: {
        start: a.dateOpened,
        end: a.dateClosed,
      },
      assessments: a.assessments,
      assignedOrgs,
    };
  });
};

export const administrationPageFetcher = async (
  orderBy,
  pageLimit,
  page,
  isSuperAdmin,
  adminOrgs,
  exhaustiveAdminOrgs,
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
