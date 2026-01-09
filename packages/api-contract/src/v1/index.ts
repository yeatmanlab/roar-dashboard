import { initContract } from '@ts-rest/core';
import { MeContract } from './me/index';
export * from './response';

const c = initContract();

export const ApiContractV1 = c.router({
  me: MeContract,
});

export * from './me/index';
