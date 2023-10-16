import _mapValues from "lodash/mapValues";
import _zip from "lodash/zip";
import { convertValues, getAxiosInstance, mapFields } from "./utils";

const getAdministrationsRequestBody = ({
  orderBy,
  aggregationQuery,
  paginate = true,
  page,
  pageLimit,
  skinnyQuery = false,
}) => {
  const requestBody = {
    structuredQuery: {
      orderBy: orderBy ?? orderByDefault,
    }
  };

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    if (skinnyQuery) {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "id" },
          { fieldPath: "name" },
        ]
      };
    } else {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "id" },
          { fieldPath: "name" },
          { fieldPath: "assessments" },
          { fieldPath: "dateClosed" },
          { fieldPath: "dateCreated" },
          { fieldPath: "dateOpened" },
          { fieldPath: "districts" },
          { fieldPath: "schools" },
          { fieldPath: "classes" },
          { fieldPath: "groups" },
          { fieldPath: "families" },
        ]
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: "administrations",
      allDescendants: false,
    }
  ];

  if (aggregationQuery) {
    return {
      structuredAggregationQuery: {
        ...requestBody,
        aggregations: [{
          alias: "count",
          count: {},
        }]
      }
    }
  }

  return requestBody;
}

export const administrationCounter = (orderBy, isSuperAdmin) => {
  if (isSuperAdmin.value) {
    const axiosInstance = getAxiosInstance();
    const requestBody = getAdministrationsRequestBody({
      aggregationQuery: true,
      orderBy: orderBy.value,
      paginate: false,
      skinnyQuery: true,
    });
    console.log(`Fetching count for administrations`);
    return axiosInstance.post(":runAggregationQuery", requestBody).then(({ data }) => {
      return Number(convertValues(data[0].result?.aggregateFields?.count));
    })
  }
}

export const administrationPageFetcher = (orderBy, pageLimit, page, isSuperAdmin, adminOrgs) => {
  if (isSuperAdmin.value) {
    const axiosInstance = getAxiosInstance();
    const requestBody = getAdministrationsRequestBody({
      aggregationQuery: false,
      orderBy: orderBy.value,
      paginate: true,
      page: page.value,
      skinnyQuery: false,
      pageLimit: pageLimit.value,
    });
    console.log(`Fetching page ${page.value} for administrations`);
    return axiosInstance.post(":runQuery", requestBody).then(async ({ data }) => {
      const administrationData = mapFields(data);
      const statsPaths = administrationData.map((administration) => `/administrations/${administration.id}/stats/completion`);
      const statsPromises = [];
      for (const docPath of statsPaths) {
        statsPromises.push(axiosInstance.get(docPath).then(({ data }) => {
          return _mapValues(data.fields, (value) => convertValues(value));
        }));
      }
      const statsData = await Promise.all(statsPromises);
      const administrations = _zip(administrationData, statsData).map(([administration, stats]) => ({
        ...administration,
        stats,
      }));

      return administrations.map((a) => {
        let assignedOrgs = {
          districts: a.districts,
          schools: a.schools,
          classes: a.classes,
          groups: a.groups,
          families: a.families,
        };
        if (!isSuperAdmin.value) {
          assignedOrgs = filterAdminOrgs(adminOrgs, assignedOrgs);
        };
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
    });
  }
}
