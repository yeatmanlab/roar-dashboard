import { initContract } from '@ts-rest/core';
import { UsersContract } from './users/index';

const c = initContract();

export const ApiContractV1 = c.router({
  users: UsersContract,
});

export * from './users/index';
