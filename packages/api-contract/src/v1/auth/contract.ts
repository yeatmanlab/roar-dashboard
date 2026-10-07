import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import {
  RegistrationAgreementsQuerySchema,
  RegistrationAgreementsResponseSchema,
  RegistrationRequestSchema,
} from './schema';

const c = initContract();

/**
 * Public contract for pre-authentication registration resources.
 *
 * Both endpoints intentionally work without an authenticated identity: new
 * caretakers need to read and accept the current agreements before their
 * Firebase account exists.
 */
export const AuthContract = c.router(
  {
    getRegistrationAgreements: {
      method: 'GET',
      path: '/registration/agreements',
      query: RegistrationAgreementsQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(RegistrationAgreementsResponseSchema),
        400: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List agreements required for registration',
      description:
        'Publicly returns the current agreement versions a new caretaker must accept, ' +
        'including their content, for the requested locale (default: en-US).',
    },
    register: {
      method: 'POST',
      path: '/registration',
      body: RegistrationRequestSchema,
      responses: {
        204: z.undefined(),
        400: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Register a caretaker and family',
      description:
        'Publicly creates the caretaker account and family and records the current required ' +
        'agreement versions atomically. The server supplies agreement timestamps.',
    },
  },
  { pathPrefix: '/auth' },
);
