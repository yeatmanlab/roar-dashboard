import { Factory } from 'fishery';
import type { AdministrationTaskVariant, NewAdministrationTaskVariant } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { administrationTaskVariants } from '../../db/schema/core';

/**
 * Factory for creating AdministrationTaskVariant junction table records.
 *
 * Usage:
 * - `AdministrationTaskVariantFactory.build()` - Creates in-memory object (unit tests)
 * - `await AdministrationTaskVariantFactory.create({ administrationId, taskVariantId, orderIndex })` - Persists to database
 *
 * IMPORTANT: administrationId and taskVariantId are required for database persistence.
 */
export const AdministrationTaskVariantFactory = Factory.define<AdministrationTaskVariant>(({ onCreate }) => {
  onCreate(async (record) => {
    if (!record.administrationId || !record.taskVariantId) {
      throw new Error('AdministrationTaskVariantFactory.create() requires administrationId and taskVariantId');
    }

    const insertData: NewAdministrationTaskVariant = {
      administrationId: record.administrationId,
      taskVariantId: record.taskVariantId,
      orderIndex: record.orderIndex,
      conditionsAssignment: record.conditionsAssignment,
      conditionsRequirements: record.conditionsRequirements,
    };

    const [inserted] = await CoreDbClient.insert(administrationTaskVariants).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert administration_task_variant');
    return inserted;
  });

  return {
    administrationId: '00000000-0000-0000-0000-000000000000', // Override required
    taskVariantId: '00000000-0000-0000-0000-000000000000', // Override required
    orderIndex: 0,
    conditionsAssignment: null,
    conditionsRequirements: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
