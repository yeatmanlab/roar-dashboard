import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Administration } from '../../db/schema';
import type { AdministrationWithEmbeds } from '../../services/administration/administration.service';

/**
 * Factory for creating Administration test objects.
 */
export const AdministrationFactory = Factory.define<Administration>(() => {
  const dateStart = faker.date.past();
  return {
    id: faker.string.uuid(),
    namePublic: faker.company.name() + ' Assessment',
    nameInternal: faker.company.name() + ' Internal',
    description: faker.lorem.sentence(),
    dateStart,
    dateEnd: faker.date.future({ refDate: dateStart }),
    isOrdered: faker.datatype.boolean(),
    createdBy: faker.string.uuid(),
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
