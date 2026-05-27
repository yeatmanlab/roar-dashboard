import { toValue } from 'vue';
import { orderByDefault } from './utils';
import { ROLES } from '@/constants/roles';
import { logger } from '@/logger';
import { fetchOrgsBySite } from './orgs';
import { administrationsRepository } from '@/firebase/repositories/AdministrationsRepository';
import { usersRepository } from '@/firebase/repositories/UsersRepository';
import { convertToDate } from '@/helpers';

export function getTitle(item, isSuperAdmin) {
  if (isSuperAdmin) {
    return item.name;
  } else {
    // Check if publicName exists, otherwise fallback to name
    return item.publicName ?? item.name;
  }
}

// TODO: Remove this function. Fields that we want should be passed into the query, not filtered from the whole data of the document on the client side.
// Netowrk call should be done in the query function, not here.
const mapAdministrations = async (data) => {
  // First format the administration documents
  const administrationData = data.map((a) => {
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
        start: convertToDate(a.dateOpened),
        end: convertToDate(a.dateClosed),
        created: convertToDate(a.dateCreated),
      },
      assessments: a.assessments,
      assignedOrgs,
      // If testData is not defined, default to false when mapping
      testData: a.testData ?? false,
      creatorName: a.creatorName,
      stats: a.stats,
      syncStatus: a.syncStatus ?? 'complete',
    };
  });

  return administrationData;
};

export const administrationPageFetcher = async (selectedDistrictId, fetchTestData = false, orderBy) => {
  const siteId =
    selectedDistrictId.value.trim() && selectedDistrictId.value !== 'any' ? selectedDistrictId.value : null;

  let orgs = [];

  const administrationData = await administrationsRepository.getAdministrations({
    testData: toValue(fetchTestData),
    idsOnly: false,
  });

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

export const fetchAdminsBySite = async (siteId, siteName) => {
  // NOTE:
  // Firestore `ARRAY_CONTAINS` on objects requires an exact match of the entire object.
  // In PROD we have pre-existing admins whose `users.roles[]` entries may not include `siteName` (or may include
  // a different/empty `siteName`), which makes exact-match queries brittle and can hide admins for a selected site.
  //
  // To keep this robust across old/new role shapes, we fetch all admin users and filter by `roles` client-side
  // using only `siteId` + `role` (ignoring `siteName`).
  try {
    const admins = await usersRepository.fetchAdminUsers();

    if (siteId.value === 'any') {
      return admins;
    }

    const selectedSiteId = siteId.value;
    const allowedSiteRoles = new Set([ROLES.ADMIN, ROLES.SITE_ADMIN, ROLES.RESEARCH_ASSISTANT]);

    return admins.filter((admin) => {
      const roles = Array.isArray(admin.roles) ? admin.roles : [];

      return roles.some((r) => {
        const rSiteId = r?.siteId;
        const rRole = r?.role;
        if (!rSiteId || !rRole) return false;

        return rSiteId === selectedSiteId && allowedSiteRoles.has(rRole);
      });
    });
  } catch (error) {
    console.error('fetchAdminsBySite: Error fetching admins by siteId:', error);
    logger.error(error, { context: { function: 'fetchAdminsBySite', siteId, siteName } });
    throw error;
  }
};
