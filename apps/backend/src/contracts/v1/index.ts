import { initContract } from '@ts-rest/core'
import { UsersContract } from './users'

const c = initContract()

export const ApiContract = c.router({
  users: UsersContract
})