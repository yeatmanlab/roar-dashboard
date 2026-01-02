import { initContract } from '@ts-rest/core';
import { MeContract } from './me/index';
import { UsersContract } from './users/index';
export * from './response';

const c = initContract();

export const ApiContractV1 = c.router({
  me: MeContract,
  users: UsersContract,
});

export * from './users/index';
export * from './me/index';
