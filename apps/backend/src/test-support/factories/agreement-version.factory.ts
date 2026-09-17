import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { AgreementVersion, NewAgreementVersion } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { agreementVersions } from '../../db/schema/core';

/**
 * Factory for creating AgreementVersion test objects.
 *
 * Usage:
 * - `AgreementVersionFactory.build()` - Creates in-memory object (unit tests)
 * - `await AgreementVersionFactory.create()` - Persists to database (integration tests)
 *
 * Required transient params for create:
 * - `agreementId` - The agreement this version belongs to
 */
export const AgreementVersionFactory = Factory.define<AgreementVersion>(({ onCreate, transientParams }) => {
  onCreate(async (version) => {
    const agreementId = transientParams.agreementId as string | undefined;
    if (!agreementId) {
      throw new Error('agreementId is required to create an AgreementVersion');
    }

    const insertData: NewAgreementVersion = {
      id: version.id,
      agreementId,
      isCurrent: version.isCurrent,
      locale: version.locale,
      githubFilename: version.githubFilename,
      githubOrgRepo: version.githubOrgRepo,
      githubCommitSha: version.githubCommitSha,
    };

    const [inserted] = await CoreDbClient.insert(agreementVersions).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert agreement version');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    agreementId: faker.string.uuid(), // Will be overridden by transientParams
    isCurrent: true,
    locale: 'en-US',
    githubFilename: 'CONSENT.md',
    githubOrgRepo: 'roar-org/legal-docs',
    githubCommitSha: faker.git.commitSha(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
