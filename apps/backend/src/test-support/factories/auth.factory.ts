import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { DecodedUser } from '../../services/auth/auth.service';

export const DecodedUserFactory = Factory.define<DecodedUser>(() => ({
  uid: faker.string.uuid(),
  email: faker.internet.email(),
  claims: {
    role: faker.helpers.arrayElement(['admin', 'user']),
    iat: faker.date.recent().getTime() / 1000,
    exp: faker.date.future().getTime() / 1000,
  },
}));

export const FirebaseDecodedTokenFactory = Factory.define<Record<string, unknown>>(() => ({
  uid: faker.string.uuid(),
  email: faker.internet.email(),
  role: faker.helpers.arrayElement(['admin', 'user']),
  iat: Math.floor(faker.date.recent().getTime() / 1000),
  exp: Math.floor(faker.date.future().getTime() / 1000),
  aud: faker.string.alphanumeric(10),
  iss: `https://securetoken.example.com/${faker.string.alphanumeric(10)}`,
}));
