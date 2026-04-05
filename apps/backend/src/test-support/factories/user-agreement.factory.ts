import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { UserAgreement, NewUserAgreement } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { userAgreements } from '../../db/schema/core';

/**
 * Factory for creating UserAgreement test objects.
 *
 * Usage:
 * - `UserAgreementFactory.build()` - Creates in-memory object (unit tests)
 * - `await UserAgreementFactory.create()` - Persists to database (integration tests)
 *
 * Note: Users can consent to the same agreement version multiple times (annual reconsent).
 * The table uses a surrogate ID primary key to support this.
 */
export const UserAgreementFactory = Factory.define<UserAgreement>(({ onCreate }) => {
  onCreate(async (userAgreement) => {
    const insertData: NewUserAgreement = {
      id: userAgreement.id,
      userId: userAgreement.userId,
      agreementVersionId: userAgreement.agreementVersionId,
      agreementTimestamp: userAgreement.agreementTimestamp,
    };

    const [inserted] = await CoreDbClient.insert(userAgreements).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert user agreement');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    agreementVersionId: faker.string.uuid(),
    agreementTimestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
