import { initContract } from '@ts-rest/core';
import { MeContract } from './me/index';
import { AdministrationsContract } from './administrations/index';
import { GroupsContract } from './groups/index';
export * from './response';
export * from './common/index';

const c = initContract();

export const ApiContractV1 = c.router({
  me: MeContract,
  administrations: AdministrationsContract,
  groups: GroupsContract,
});

export * from './me/index';
export * from './administrations/index';
export * from './groups/index';
