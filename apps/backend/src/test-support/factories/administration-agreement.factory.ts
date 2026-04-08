import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { AdministrationAgreement, NewAdministrationAgreement } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { administrationAgreements } from '../../db/schema/core';

/**
 * Factory for creating AdministrationAgreement junction table test objects.
 *
 * Usage:
 * - `AdministrationAgreementFactory.build()` - Creates in-memory object (unit tests)
 * - `await AdministrationAgreementFactory.create()` - Persists to database (integration tests)
 *
 * Required transient params for create:
 * - `administrationId` - The administration to link
 * - `agreementId` - The agreement to link
 */
export const AdministrationAgreementFactory = Factory.define<AdministrationAgreement>(
  ({ onCreate, transientParams }) => {
    onCreate(async () => {
      const administrationId = transientParams.administrationId as string | undefined;
      const agreementId = transientParams.agreementId as string | undefined;

      if (!administrationId || !agreementId) {
        throw new Error('administrationId and agreementId are required to create an AdministrationAgreement');
      }

      const insertData: NewAdministrationAgreement = {
        administrationId,
        agreementId,
      };

      const [inserted] = await CoreDbClient.insert(administrationAgreements).values(insertData).returning();
      if (!inserted) throw new Error('Failed to insert administration agreement');
      return inserted;
    });

    return {
      administrationId: faker.string.uuid(),
      agreementId: faker.string.uuid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
);
