/**
 * Integration tests for factory database persistence.
 * Verifies that factory.create() properly inserts records into the database.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { CoreDbClient } from '../../db/clients';
import { users, administrations } from '../../db/schema/core';
import { UserFactory } from './user.factory';
import { AdministrationFactory } from './administration.factory';

describe('Factory Database Persistence', () => {
  describe('UserFactory', () => {
    it('build() creates in-memory object without persisting', async () => {
      const user = UserFactory.build();

      // Verify it's a valid user object
      expect(user.id).toBeDefined();
      expect(user.assessmentPid).toBeDefined();
      expect(user.email).toBeDefined();

      // Verify it was NOT persisted to database
      const dbUser = await CoreDbClient.query.users.findFirst({
        where: eq(users.id, user.id),
      });
      expect(dbUser).toBeUndefined();
    });

    it('create() persists user to database', async () => {
      const user = await UserFactory.create();

      // Verify it was persisted to database
      const dbUser = await CoreDbClient.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      expect(dbUser).toBeDefined();
      expect(dbUser!.id).toBe(user.id);
      expect(dbUser!.email).toBe(user.email);
      expect(dbUser!.assessmentPid).toBe(user.assessmentPid);
    });

    it('create() with overrides persists custom values', async () => {
      const user = await UserFactory.create({
        nameFirst: 'Test',
        nameLast: 'User',
        userType: 'educator',
      });

      const dbUser = await CoreDbClient.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      expect(dbUser!.nameFirst).toBe('Test');
      expect(dbUser!.nameLast).toBe('User');
      expect(dbUser!.userType).toBe('educator');
    });
  });

  describe('AdministrationFactory', () => {
    it('build() creates in-memory object without persisting', async () => {
      const admin = AdministrationFactory.build();

      expect(admin.id).toBeDefined();
      expect(admin.name).toBeDefined();

      // Verify it was NOT persisted
      const dbAdmin = await CoreDbClient.query.administrations.findFirst({
        where: eq(administrations.id, admin.id),
      });
      expect(dbAdmin).toBeUndefined();
    });

    it('create() persists administration and auto-creates user for createdBy', async () => {
      const admin = await AdministrationFactory.create();

      // Verify administration was persisted
      const dbAdmin = await CoreDbClient.query.administrations.findFirst({
        where: eq(administrations.id, admin.id),
      });

      expect(dbAdmin).toBeDefined();
      expect(dbAdmin!.name).toBe(admin.name);

      // Verify the createdBy user was also created
      const dbUser = await CoreDbClient.query.users.findFirst({
        where: eq(users.id, admin.createdBy),
      });
      expect(dbUser).toBeDefined();
    });

    it('create() with explicit createdBy uses existing user', async () => {
      // Create user first
      const user = await UserFactory.create();

      // Create administration with that user
      const admin = await AdministrationFactory.create({
        createdBy: user.id,
      });

      expect(admin.createdBy).toBe(user.id);

      // Verify only one user exists (not auto-created)
      const dbUsers = await CoreDbClient.select().from(users);
      expect(dbUsers).toHaveLength(1);
    });
  });
});
