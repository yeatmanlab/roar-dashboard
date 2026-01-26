import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Administration, NewAdministration } from '../../db/schema';
import type { AdministrationWithEmbeds } from '../../services/administration/administration.service';
import { CoreDbClient } from '../../db/clients';
import { administrations } from '../../db/schema/core';
import { UserFactory } from './user.factory';

/**
 * Factory for creating Administration test objects.
 *
 * Usage:
 * - `AdministrationFactory.build()` - Creates in-memory object (unit tests)
 * - `await AdministrationFactory.create()` - Persists to database (integration tests)
 * - `await AdministrationFactory.create({ createdBy: userId })` - Use existing user
 *
 * Note: When using `create()` without a `createdBy`, a user will be created automatically.
 */
export const AdministrationFactory = Factory.define<Administration>(({ onCreate }) => {
  onCreate(async (administration) => {
    // If createdBy is a placeholder UUID, create a real user first
    let createdBy = administration.createdBy;
    if (!createdBy || createdBy === '00000000-0000-0000-0000-000000000000') {
      const user = await UserFactory.create();
      createdBy = user.id;
    }

    const insertData: NewAdministration = {
      id: administration.id,
      name: administration.name,
      namePublic: administration.namePublic,
      description: administration.description,
      dateStart: administration.dateStart,
      dateEnd: administration.dateEnd,
      isOrdered: administration.isOrdered,
      createdBy,
    };

    const [inserted] = await CoreDbClient.insert(administrations).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert administration');
    return inserted;
  });

  const dateStart = faker.date.past();
  return {
    id: faker.string.uuid(),
    namePublic: faker.company.name() + ' Assessment',
    name: faker.company.name() + ' Internal',
    description: faker.lorem.sentence(),
    dateStart,
    dateEnd: faker.date.future({ refDate: dateStart }),
    isOrdered: faker.datatype.boolean(),
    // Placeholder - will be replaced in onCreate if not overridden
    createdBy: '00000000-0000-0000-0000-000000000000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

/**
 * Factory for creating AdministrationWithEmbeds test objects.
 */
export const AdministrationWithEmbedsFactory = Factory.define<AdministrationWithEmbeds>(() => {
  return AdministrationFactory.build();
});
