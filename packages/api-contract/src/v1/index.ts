import { initContract } from '@ts-rest/core';
import { MeContract } from './me/index';
import { AdministrationsContract } from './administrations/index';
export * from './response';
export * from './common/index';

const c = initContract();

export const ApiContractV1 = c.router({
  me: MeContract,
  administrations: AdministrationsContract,
});

export * from './me/index';
export * from './administrations/index';
