import { Factory } from 'fishery';
import type { AdministrationGroup, NewAdministrationGroup } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { administrationGroups } from '../../db/schema/core';

/**
 * Factory for creating AdministrationGroup junction table records.
 *
 * Usage:
 * - `AdministrationGroupFactory.build()` - Creates in-memory object (unit tests)
 * - `await AdministrationGroupFactory.create({ administrationId, groupId })` - Persists to database
 *
 * IMPORTANT: administrationId and groupId are required for database persistence.
 */
export const AdministrationGroupFactory = Factory.define<AdministrationGroup>(({ onCreate }) => {
  onCreate(async (adminGroup) => {
    if (!adminGroup.administrationId || !adminGroup.groupId) {
      throw new Error('AdministrationGroupFactory.create() requires administrationId and groupId');
    }

    const insertData: NewAdministrationGroup = {
      administrationId: adminGroup.administrationId,
      groupId: adminGroup.groupId,
    };

    const [inserted] = await CoreDbClient.insert(administrationGroups).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert administration_group');
    return inserted;
  });

  return {
    administrationId: '00000000-0000-0000-0000-000000000000', // Override required
    groupId: '00000000-0000-0000-0000-000000000000', // Override required
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
