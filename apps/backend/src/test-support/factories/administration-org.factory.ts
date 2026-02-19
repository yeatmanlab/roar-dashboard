import { Factory } from 'fishery';
import type { AdministrationOrg, NewAdministrationOrg } from '../../db/schema';
import { getCoreDbClient } from '../../db/clients';
import { administrationOrgs } from '../../db/schema/core';

/**
 * Factory for creating AdministrationOrg junction table records.
 *
 * Usage:
 * - `AdministrationOrgFactory.build()` - Creates in-memory object (unit tests)
 * - `await AdministrationOrgFactory.create({ administrationId, orgId })` - Persists to database
 *
 * IMPORTANT: administrationId and orgId are required for database persistence.
 */
export const AdministrationOrgFactory = Factory.define<AdministrationOrg>(({ onCreate }) => {
  onCreate(async (adminOrg) => {
    if (!adminOrg.administrationId || !adminOrg.orgId) {
      throw new Error('AdministrationOrgFactory.create() requires administrationId and orgId');
    }

    const insertData: NewAdministrationOrg = {
      administrationId: adminOrg.administrationId,
      orgId: adminOrg.orgId,
    };

    const [inserted] = await getCoreDbClient().insert(administrationOrgs).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert administration_org');
    return inserted;
  });

  return {
    administrationId: '00000000-0000-0000-0000-000000000000', // Override required
    orgId: '00000000-0000-0000-0000-000000000000', // Override required
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
