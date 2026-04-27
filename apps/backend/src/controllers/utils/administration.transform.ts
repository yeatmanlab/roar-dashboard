import type {
  Administration as ContractAdministrationBase,
  Administration as ContractAdministration,
} from '@roar-dashboard/api-contract';
import type { Administration } from '../../db/schema';
import type { AdministrationWithEmbeds } from '../../services/administration/administration.service';
/**
 * Maps a database Administration entity to the base API schema.
 * Converts Date fields to ISO strings and renames fields to match the contract.
 *
 * @param admin - The database Administration entity
 * @returns The API-formatted administration base object
 */
export function transformAdministrationBase(admin: Administration): ContractAdministrationBase {
  return {
    id: admin.id,
    name: admin.name,
    publicName: admin.namePublic,
    dates: {
      start: admin.dateStart.toISOString(),
      end: admin.dateEnd.toISOString(),
      created: admin.createdAt.toISOString(),
    },
    isOrdered: admin.isOrdered,
  };
}

/**
 * Maps a database Administration entity to the full API schema, attaching
 * optional embed data (stats, tasks) when present.
 *
 * @param admin - The database Administration entity with optional embeds
 * @returns The API-formatted administration object with embedded data
 */
export function transformAdministration(admin: AdministrationWithEmbeds): ContractAdministration {
  const result: ContractAdministration = transformAdministrationBase(admin);

  // Include stats if embedded
  if (admin.stats) {
    result.stats = admin.stats;
  }

  // Include tasks if embedded
  if (admin.tasks) {
    result.tasks = admin.tasks;
  }

  return result;
}
