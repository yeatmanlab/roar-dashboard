import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Administration, NewAdministration } from '../../db/schema';
import type { AdministrationWithEmbeds } from '../../services/administration/administration.service';
import { CoreDbClient } from '../../db/clients';
import { administrations } from '../../db/schema/core';

/**
 * Factory for creating Administration test objects.
 *
 * Usage:
 * - `AdministrationFactory.build()` - Creates in-memory object (unit tests)
 * - `await AdministrationFactory.create({ createdBy: userId })` - Persists to database (integration tests)
 *
 * Note: `createdBy` is required when using `create()`. The referenced user must already exist.
 */
export const AdministrationFactory = Factory.define<Administration>(({ onCreate }) => {
  onCreate(async (administration) => {
    if (!administration.createdBy || administration.createdBy === '00000000-0000-0000-0000-000000000000') {
      throw new Error('AdministrationFactory.create() requires createdBy to reference an existing user');
    }

    const insertData: NewAdministration = {
      id: administration.id,
      name: administration.name,
      namePublic: administration.namePublic,
      description: administration.description,
      dateStart: administration.dateStart,
      dateEnd: administration.dateEnd,
      isOrdered: administration.isOrdered,
      createdBy: administration.createdBy,
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
    createdBy: '00000000-0000-0000-0000-000000000000', // Sentinel; must be overridden when using create()
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
