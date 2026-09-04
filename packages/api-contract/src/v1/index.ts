import { initContract } from '@ts-rest/core';
import { MeContract } from './me/index';
import { AdministrationsContract } from './administrations/index';
import { AgreementsContract } from './agreements/index';
import { RunsContract } from './runs/index';
import { DistrictsContract } from './districts/index';
import { SchoolsContract } from './schools/index';
import { GroupsContract } from './groups/index';
import { TasksContract, TaskVariantsContract } from './tasks/index';
import { TaskBundlesContract } from './task-bundles/index';
import { ClassesContract } from './classes/index';
import { UsersContract } from './users/index';
import { SystemContract } from './system/index';
import { FamiliesContract } from './families/index';
export * from './response';
export * from './common/index';

const c = initContract();

/**
 * Path prefix this version of the API is served under.
 *
 * Each version directory declares its own prefix rather than sharing a registry, so a new version
 * is added by creating `src/<version>/` and nothing else, and retiring one is a directory delete.
 *
 * The prefix belongs to the contract rather than to deployment configuration: which version a
 * caller speaks is decided by the contract it compiled against, not by where the API is hosted.
 * Clients receive it automatically through the composed contract below, which is why
 * `ROAR_API_BASE_URL` / `VITE_ROAR_API_BASE_URL` are plain origins with no path.
 *
 * The backend serves these routes under an equivalent prefix that it defines independently, since
 * where it mounts the router is its own concern.
 */
const V1_PATH_PREFIX = '/v1';

export const ApiContractV1 = c.router(
  {
    me: MeContract,
    administrations: AdministrationsContract,
    agreements: AgreementsContract,
    runs: RunsContract,
    districts: DistrictsContract,
    schools: SchoolsContract,
    groups: GroupsContract,
    tasks: TasksContract,
    taskVariants: TaskVariantsContract,
    taskBundles: TaskBundlesContract,
    classes: ClassesContract,
    users: UsersContract,
    system: SystemContract,
    families: FamiliesContract,
  },
  { pathPrefix: V1_PATH_PREFIX },
);

export * from './me/index';
export * from './administrations/index';
export * from './agreements/index';
export * from './runs/index';
export * from './districts/index';
export * from './schools/index';
export * from './groups/index';
export * from './tasks/index';
export * from './task-bundles/index';
export * from './classes/index';
export * from './users/index';
export * from './system/index';
export * from './families/index';
