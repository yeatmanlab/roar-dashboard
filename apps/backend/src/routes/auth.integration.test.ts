import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type express from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { AgreementType } from '../enums/agreement-type.enum';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { FirebaseAuthClient } from '../clients/firebase-auth.clients';
import { agreements, agreementVersions, families, userAgreements, userFamilies, users } from '../db/schema';
import { CoreDbClient } from '../test-support/db';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { createRouteHelper, createTestApp } from '../test-support/route-test.helper';

vi.mock('../clients/firebase-auth.clients', () => ({
  FirebaseAuthClient: {
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

const mockAuth = FirebaseAuthClient as unknown as {
  createUser: ReturnType<typeof vi.fn>;
  getUserByEmail: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
};

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let emailSequence = 0;
let firebaseSequence = 0;

beforeAll(async () => {
  const { registerAuthRoutes } = await import('./auth');
  app = createTestApp(registerAuthRoutes);
  expectRoute = createRouteHelper(app);

  const consent = await AgreementFactory.create({
    name: 'Registration consent fixture',
    agreementType: AgreementType.CONSENT,
  });
  const tos = await AgreementFactory.create({
    name: 'Registration TOS fixture',
    agreementType: AgreementType.TOS,
  });
  await Promise.all([
    AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: consent.id } }),
    AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: tos.id } }),
  ]);
});

beforeEach(() => {
  mockAuth.getUserByEmail.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'auth/user-not-found' }));
  mockAuth.createUser.mockImplementation(async () => ({ uid: `registration-firebase-${++firebaseSequence}` }));
  mockAuth.deleteUser.mockResolvedValue(undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# Registration agreement',
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function getRequiredAgreementVersionIds(): Promise<string[]> {
  const rows = await CoreDbClient.select({
    agreementId: agreements.id,
    agreementVersionId: agreementVersions.id,
  })
    .from(agreementVersions)
    .innerJoin(agreements, eq(agreementVersions.agreementId, agreements.id))
    .where(
      and(
        eq(agreementVersions.isCurrent, true),
        eq(agreementVersions.locale, 'en-US'),
        inArray(agreements.agreementType, [AgreementType.CONSENT, AgreementType.TOS]),
      ),
    );

  return [...new Map(rows.map((row) => [row.agreementId, row.agreementVersionId])).values()];
}

async function validRegistrationBody() {
  const suffix = ++emailSequence;
  return {
    email: `registration-${suffix}@example.com`,
    password: 'Password123!',
    name: { first: 'Registration', last: `Parent${suffix}` },
    agreements: (await getRequiredAgreementVersionIds()).map((agreementVersionId) => ({ agreementVersionId })),
    optIns: { researchContact: suffix % 2 === 0 },
  };
}

describe('GET /v1/auth/registration/agreements', () => {
  it('is public and returns current adult-signable content inline', async () => {
    const consent = await AgreementFactory.create({
      name: 'English registration consent',
      agreementType: AgreementType.CONSENT,
    });
    const consentVersion = await AgreementVersionFactory.create(
      { isCurrent: true, locale: 'en-US' },
      { transient: { agreementId: consent.id } },
    );
    const assent = await AgreementFactory.create({
      name: 'English child assent',
      agreementType: AgreementType.ASSENT,
    });
    await AgreementVersionFactory.create(
      { isCurrent: true, locale: 'en-US' },
      { transient: { agreementId: assent.id } },
    );

    const response = await expectRoute('GET', '/v1/auth/registration/agreements?locale=en-US')
      .unauthenticated()
      .toReturn(200);

    const item = response.body.data.items.find(
      (candidate: { agreementVersionId: string }) => candidate.agreementVersionId === consentVersion.id,
    );
    expect(item).toMatchObject({
      agreementId: consent.id,
      agreementVersionId: consentVersion.id,
      agreementType: AgreementType.CONSENT,
      name: consent.name,
      locale: 'en-US',
      content: '# Registration agreement',
    });
    expect(response.body.data.items).not.toContainEqual(expect.objectContaining({ agreementId: assent.id }));
    expect(response.headers['cache-control']).toBe('public, no-cache');
  });

  it('falls back to en-US per agreement when the requested locale is incomplete', async () => {
    const consent = await AgreementFactory.create({
      name: 'Spanish registration consent',
      agreementType: AgreementType.CONSENT,
    });
    await AgreementVersionFactory.create(
      { isCurrent: true, locale: 'es-MX' },
      { transient: { agreementId: consent.id } },
    );

    const response = await expectRoute('GET', '/v1/auth/registration/agreements?locale=es-MX')
      .unauthenticated()
      .toReturn(200);

    expect(response.body.data.items).toContainEqual(
      expect.objectContaining({ agreementId: consent.id, locale: 'es-MX' }),
    );
    expect(response.body.data.items).toContainEqual(expect.objectContaining({ locale: 'en-US' }));
  });

  it('does not make an agreement required outside its available locale or en-US fallback', async () => {
    const spanishOnlyAgreement = await AgreementFactory.create({
      name: 'Spanish-only registration consent',
      agreementType: AgreementType.CONSENT,
    });
    await AgreementVersionFactory.create(
      { isCurrent: true, locale: 'es-MX' },
      { transient: { agreementId: spanishOnlyAgreement.id } },
    );

    const response = await expectRoute('GET', '/v1/auth/registration/agreements?locale=en-US')
      .unauthenticated()
      .toReturn(200);

    expect(response.body.data.items).not.toContainEqual(
      expect.objectContaining({ agreementId: spanishOnlyAgreement.id }),
    );
  });

  it('returns 400 for an invalid locale', async () => {
    const response = await expectRoute('GET', '/v1/auth/registration/agreements?locale=invalid')
      .unauthenticated()
      .toReturn(400);

    expect(response.headers['cache-control']).toBeUndefined();
  });
});

describe('POST /v1/auth/registration', () => {
  it('creates the caretaker, family, membership, and agreement rows atomically', async () => {
    const body = await validRegistrationBody();

    const response = await expectRoute('POST', '/v1/auth/registration').unauthenticated().withBody(body).toReturn(204);

    expect(response.body).toEqual({});
    const [caretaker] = await CoreDbClient.select().from(users).where(eq(users.email, body.email));
    expect(caretaker).toBeDefined();
    expect(caretaker!.optinResearchContact).toBe(body.optIns.researchContact);

    const [family] = await CoreDbClient.select().from(families).where(eq(families.createdBy, caretaker!.id));
    expect(family).toBeDefined();

    const [membership] = await CoreDbClient.select()
      .from(userFamilies)
      .where(and(eq(userFamilies.userId, caretaker!.id), eq(userFamilies.familyId, family!.id)));
    expect(membership?.role).toBe('parent');

    const recordedAgreements = await CoreDbClient.select()
      .from(userAgreements)
      .where(eq(userAgreements.userId, caretaker!.id));
    expect(recordedAgreements).toHaveLength(body.agreements.length);
    expect(new Set(recordedAgreements.map(({ agreementVersionId }) => agreementVersionId))).toEqual(
      new Set(body.agreements.map(({ agreementVersionId }) => agreementVersionId)),
    );
    expect(recordedAgreements.every(({ agreementTimestamp }) => agreementTimestamp instanceof Date)).toBe(true);
  });

  it('returns 422 before Firebase creation when a required agreement is missing', async () => {
    const body = await validRegistrationBody();
    body.agreements.pop();

    const response = await expectRoute('POST', '/v1/auth/registration').unauthenticated().withBody(body).toReturn(422);

    expect(response.body.error.code).toBe(ApiErrorCode.RESOURCE_UNPROCESSABLE);
    expect(mockAuth.createUser).not.toHaveBeenCalled();
  });

  it('returns 422 before Firebase creation for a stale agreement version', async () => {
    const staleAgreement = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
    const staleVersion = await AgreementVersionFactory.create(
      { isCurrent: false, locale: 'en-US' },
      { transient: { agreementId: staleAgreement.id } },
    );
    const body = await validRegistrationBody();
    body.agreements.push({ agreementVersionId: staleVersion.id });

    await expectRoute('POST', '/v1/auth/registration').unauthenticated().withBody(body).toReturn(422);
    expect(mockAuth.createUser).not.toHaveBeenCalled();
  });

  it('rejects client-supplied agreement timestamps with 400', async () => {
    const body = await validRegistrationBody();
    const agreementsWithTimestamp = body.agreements.map((agreement) => ({
      ...agreement,
      confirmedAt: new Date().toISOString(),
    }));

    await expectRoute('POST', '/v1/auth/registration')
      .unauthenticated()
      .withBody({ ...body, agreements: agreementsWithTimestamp })
      .toReturn(400);
    expect(mockAuth.createUser).not.toHaveBeenCalled();
  });
});
