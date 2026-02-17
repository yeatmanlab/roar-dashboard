import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InvitationCodeRepository } from './invitation-code.repository';
import { invitationCodes, groups } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import { sql } from 'drizzle-orm';

describe('InvitationCodeRepository Integration Tests', () => {
  let repository: InvitationCodeRepository;
  let testGroupId: string;

  beforeEach(async () => {
    repository = new InvitationCodeRepository();

    // Create a test group
    const [group] = await CoreDbClient.insert(groups)
      .values({
        name: 'Test Group',
        orgId: sql`gen_random_uuid()`,
        abbreviation: 'TG',
      })
      .returning();
    testGroupId = group.id;
  });

  afterEach(async () => {
    // Clean up test data
    await CoreDbClient.delete(invitationCodes).where(sql`group_id = ${testGroupId}`);
    await CoreDbClient.delete(groups).where(sql`id = ${testGroupId}`);
  });

  describe('getLatestValidByGroupId', () => {
    it('should return the latest valid invitation code', async () => {
      // Insert multiple invitation codes
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const [, newer] = await CoreDbClient.insert(invitationCodes)
        .values([
          {
            groupId: testGroupId,
            code: 'OLDER123',
            validFrom: yesterday,
            validTo: tomorrow,
          },
          {
            groupId: testGroupId,
            code: 'NEWER456',
            validFrom: yesterday,
            validTo: tomorrow,
          },
        ])
        .returning();

      const result = await repository.getLatestValidByGroupId(testGroupId);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('NEWER456');
      expect(result?.id).toBe(newer.id);
    });

    it('should return null when no valid invitation code exists', async () => {
      const result = await repository.getLatestValidByGroupId(testGroupId);

      expect(result).toBeNull();
    });

    it('should filter out codes that have not started yet', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await CoreDbClient.insert(invitationCodes).values({
        groupId: testGroupId,
        code: 'FUTURE123',
        validFrom: tomorrow,
        validTo: nextWeek,
      });

      const result = await repository.getLatestValidByGroupId(testGroupId);

      expect(result).toBeNull();
    });

    it('should filter out expired codes', async () => {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await CoreDbClient.insert(invitationCodes).values({
        groupId: testGroupId,
        code: 'EXPIRED123',
        validFrom: lastWeek,
        validTo: yesterday,
      });

      const result = await repository.getLatestValidByGroupId(testGroupId);

      expect(result).toBeNull();
    });

    it('should include codes with null validTo (no expiration)', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await CoreDbClient.insert(invitationCodes)
        .values({
          groupId: testGroupId,
          code: 'NOEXPIRY123',
          validFrom: yesterday,
          validTo: null,
        })
        .returning();

      const result = await repository.getLatestValidByGroupId(testGroupId);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('NOEXPIRY123');
      expect(result?.validTo).toBeNull();
    });

    it('should only return codes for the specified group', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create another group
      const [otherGroup] = await CoreDbClient.insert(groups)
        .values({
          name: 'Other Group',
          orgId: sql`gen_random_uuid()`,
          abbreviation: 'OG',
        })
        .returning();

      // Insert codes for both groups
      await CoreDbClient.insert(invitationCodes).values([
        {
          groupId: testGroupId,
          code: 'TESTGROUP123',
          validFrom: yesterday,
          validTo: tomorrow,
        },
        {
          groupId: otherGroup.id,
          code: 'OTHERGROUP456',
          validFrom: yesterday,
          validTo: tomorrow,
        },
      ]);

      const result = await repository.getLatestValidByGroupId(testGroupId);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('TESTGROUP123');

      // Clean up other group
      await CoreDbClient.delete(invitationCodes).where(sql`group_id = ${otherGroup.id}`);
      await CoreDbClient.delete(groups).where(sql`id = ${otherGroup.id}`);
    });

    it('should handle codes that are valid right now (edge case)', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const oneMinuteFromNow = new Date(Date.now() + 60 * 1000);

      await CoreDbClient.insert(invitationCodes).values({
        groupId: testGroupId,
        code: 'VALIDNOW123',
        validFrom: oneMinuteAgo,
        validTo: oneMinuteFromNow,
      });

      const result = await repository.getLatestValidByGroupId(testGroupId);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALIDNOW123');
    });
  });
});
