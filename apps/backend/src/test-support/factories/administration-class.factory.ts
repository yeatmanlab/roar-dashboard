import { Factory } from 'fishery';
import type { AdministrationClass, NewAdministrationClass } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { administrationClasses } from '../../db/schema/core';

/**
 * Factory for creating AdministrationClass junction table records.
 *
 * Usage:
 * - `AdministrationClassFactory.build()` - Creates in-memory object (unit tests)
 * - `await AdministrationClassFactory.create({ administrationId, classId })` - Persists to database
 *
 * IMPORTANT: administrationId and classId are required for database persistence.
 */
export const AdministrationClassFactory = Factory.define<AdministrationClass>(({ onCreate }) => {
  onCreate(async (adminClass) => {
    if (!adminClass.administrationId || !adminClass.classId) {
      throw new Error('AdministrationClassFactory.create() requires administrationId and classId');
    }

    const insertData: NewAdministrationClass = {
      administrationId: adminClass.administrationId,
      classId: adminClass.classId,
    };

    const [inserted] = await CoreDbClient.insert(administrationClasses).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert administration_class');
    return inserted;
  });

  return {
    administrationId: '00000000-0000-0000-0000-000000000000', // Override required
    classId: '00000000-0000-0000-0000-000000000000', // Override required
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
