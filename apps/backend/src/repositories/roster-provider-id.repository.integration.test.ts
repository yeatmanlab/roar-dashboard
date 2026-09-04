/**
 * Integration tests for RosterProviderIdRepository.
 *
 * Exercises both branches of the `transaction ?? this.db` pattern in `create()`
 * and `deleteByEntityId()`:
 *   - Without a transaction: uses the repository's own `this.db` connection.
 *   - With a transaction: executes inside a caller-supplied transaction, which
 *     can be rolled back to prove atomicity.
 *
 * A fresh user is created for each test to satisfy the `validate_rostering_entity_fk`
 * trigger (which verifies that `entity_id` exists in `app.users` for entity_type = 'user').
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { RosterProviderIdRepository } from './roster-provider-id.repository';
import { RosteringProvider } from '../enums/rostering-provider.enum';
import { RosteringEntityType } from '../enums/rostering-entity-type.enum';
import { UserFactory } from '../test-support/factories/user.factory';
import { CoreDbClient } from '../test-support/db';
import { rosteringProviderIds } from '../db/schema';
import { baseFixture } from '../test-support/fixtures';

describe('RosterProviderIdRepository', () => {
  let repository: RosterProviderIdRepository;

  beforeAll(() => {
    repository = new RosterProviderIdRepository();
  });

  /** Build a minimal valid insert payload for a given user ID. */
  function makeRecord(userId: string) {
    return {
      providerType: RosteringProvider.DASHBOARD,
      providerId: userId,
      partnerId: baseFixture.district.id,
      entityType: RosteringEntityType.USER,
      entityId: userId,
    };
  }

  /** Query the row back directly to verify it was written or removed. */
  async function findRecord(entityId: string) {
    const [row] = await CoreDbClient.select()
      .from(rosteringProviderIds)
      .where(
        and(
          eq(rosteringProviderIds.entityId, entityId),
          eq(rosteringProviderIds.providerType, RosteringProvider.DASHBOARD),
        ),
      );
    return row ?? null;
  }

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('inserts a record using this.db when no transaction is supplied', async () => {
      const user = await UserFactory.create();

      await repository.create({ data: makeRecord(user.id) });

      const row = await findRecord(user.id);
      expect(row).not.toBeNull();
      expect(row!.providerId).toBe(user.id);
      expect(row!.partnerId).toBe(baseFixture.district.id);
      expect(row!.entityType).toBe(RosteringEntityType.USER);
    });

    it('inserts a record within a supplied transaction and commits on success', async () => {
      const user = await UserFactory.create();

      await CoreDbClient.transaction(async (tx) => {
        await repository.create({ data: makeRecord(user.id), transaction: tx });
      });

      const row = await findRecord(user.id);
      expect(row).not.toBeNull();
    });

    it('does not insert when the supplied transaction is rolled back', async () => {
      const user = await UserFactory.create();

      await CoreDbClient.transaction(async (tx) => {
        await repository.create({ data: makeRecord(user.id), transaction: tx });
        await tx.rollback();
      }).catch(() => {
        // tx.rollback() throws; swallow the intentional abort
      });

      expect(await findRecord(user.id)).toBeNull();
    });
  });

  // ── deleteByEntityId() ────────────────────────────────────────────────────

  describe('deleteByEntityId()', () => {
    it('removes the record using this.db when no transaction is supplied', async () => {
      const user = await UserFactory.create();
      await repository.create({ data: makeRecord(user.id) });

      await repository.deleteByEntityId(user.id);

      expect(await findRecord(user.id)).toBeNull();
    });

    it('removes the record within a supplied transaction and commits on success', async () => {
      const user = await UserFactory.create();
      await repository.create({ data: makeRecord(user.id) });

      await CoreDbClient.transaction(async (tx) => {
        await repository.deleteByEntityId(user.id, tx);
      });

      expect(await findRecord(user.id)).toBeNull();
    });

    it('does not remove the record when the supplied transaction is rolled back', async () => {
      const user = await UserFactory.create();
      await repository.create({ data: makeRecord(user.id) });

      await CoreDbClient.transaction(async (tx) => {
        await repository.deleteByEntityId(user.id, tx);
        await tx.rollback();
      }).catch(() => {
        // tx.rollback() throws; swallow the intentional abort
      });

      // Row must still exist — the transaction rolled back
      expect(await findRecord(user.id)).not.toBeNull();
    });
  });
});
