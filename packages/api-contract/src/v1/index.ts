import { initContract } from '@ts-rest/core';
import { MeContract } from './me/index';
import { AdministrationsContract } from './administrations/index';
import { RunsContract } from './runs/index';
export * from './response';
export * from './common/index';

const c = initContract();

export const ApiContractV1 = c.router({
  me: MeContract,
  administrations: AdministrationsContract,
  runs: RunsContract,
});

export * from './me/index';
export * from './administrations/index';
export * from './runs/index';
