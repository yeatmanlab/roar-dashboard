import { initContract } from '@ts-rest/core';
import { MeContract } from './me/index';
import { AdministrationsContract } from './administrations/index';
import { RunsContract } from './runs/index';
import { DistrictsContract } from './districts/index';
import { GroupsContract } from './groups/index';
import { TasksContract } from './tasks/index';
import { ClassesContract } from './classes/index';
import { UsersContract } from './users/index';
import { SystemContract } from './system/index';
export * from './response';
export * from './common/index';

const c = initContract();

export const ApiContractV1 = c.router({
  me: MeContract,
  administrations: AdministrationsContract,
  runs: RunsContract,
  districts: DistrictsContract,
  groups: GroupsContract,
  tasks: TasksContract,
  classes: ClassesContract,
  users: UsersContract,
  system: SystemContract,
});

export * from './me/index';
export * from './administrations/index';
export * from './runs/index';
export * from './districts/index';
export * from './groups/index';
export * from './tasks/index';
export * from './classes/index';
export * from './users/index';
export * from './system/index';
