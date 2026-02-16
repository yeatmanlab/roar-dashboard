import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Agreement, NewAgreement } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { agreements } from '../../db/schema/core';

/**
 * Factory for creating Agreement test objects.
 *
 * Usage:
 * - `AgreementFactory.build()` - Creates in-memory object (unit tests)
 * - `await AgreementFactory.create()` - Persists to database (integration tests)
 */
export const AgreementFactory = Factory.define<Agreement>(({ onCreate, sequence }) => {
  onCreate(async (agreement) => {
    const insertData: NewAgreement = {
      id: agreement.id,
      name: agreement.name,
      agreementType: agreement.agreementType,
      requiresMajorityAge: agreement.requiresMajorityAge,
    };

    const [inserted] = await CoreDbClient.insert(agreements).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert agreement');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    name: `Agreement ${sequence}`,
    agreementType: faker.helpers.arrayElement(['tos', 'assent', 'consent'] as const),
    requiresMajorityAge: faker.datatype.boolean(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
