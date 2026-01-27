import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Administration, NewAdministration } from '../../db/schema';
import type { AdministrationWithEmbeds } from '../../services/administration/administration.service';
import { CoreDbClient } from '../../db/clients';
import { administrations } from '../../db/schema/core';
import { UserFactory } from './user.factory';
import { UserType } from '../../enums/user-type.enum';

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
    // If createdBy is a placeholder UUID, create an admin user first to use as creator
    let createdBy = administration.createdBy;
    if (!createdBy || createdBy === '00000000-0000-0000-0000-000000000000') {
      const user = await UserFactory.create({ userType: UserType.ADMIN });
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
  const administrationName = faker.word.words(3).replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: faker.string.uuid(),
    namePublic: `${administrationName} Administration`,
    name: `${administrationName} Internal`,
    description: faker.lorem.sentence(),
    dateStart,
    dateEnd: faker.date.future({ refDate: dateStart }),
    isOrdered: faker.datatype.boolean(),
    createdBy: '00000000-0000-0000-0000-000000000000', // Auto-created if not overridden
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
