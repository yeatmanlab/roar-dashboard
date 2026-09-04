import type { AdministrationAgreement } from '@roar-platform/api-contract';
import type { AgreementWithVersion } from '../../repositories/administration.repository';

/**
 * Maps an AgreementWithVersion (raw repository data) to the API response schema.
 *
 * Flattens the repository's nested `{ agreement, currentVersion }` into the
 * contract's agreement shape, converting the current version to its nested
 * object (or `null` when no version exists for the requested locale).
 *
 * Shared across the administrations and users controllers so the agreement
 * shape stays identical wherever it is returned. The per-user variant layers
 * a `signed` flag on top of this base (see the users controller).
 *
 * @param item - The raw agreement data from the repository (agreement and currentVersion)
 * @returns The API-formatted agreement item with nested currentVersion
 */
export function toAgreementItem(item: AgreementWithVersion): AdministrationAgreement {
  return {
    id: item.agreement.id,
    name: item.agreement.name,
    agreementType: item.agreement.agreementType,
    currentVersion: item.currentVersion
      ? {
          id: item.currentVersion.id,
          locale: item.currentVersion.locale,
          githubFilename: item.currentVersion.githubFilename,
          githubOrgRepo: item.currentVersion.githubOrgRepo,
          githubCommitSha: item.currentVersion.githubCommitSha,
        }
      : null,
  };
}
