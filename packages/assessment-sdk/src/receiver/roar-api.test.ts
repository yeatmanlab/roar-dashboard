import { describe, it, expect } from 'vitest';
import { RoarApi } from './roar-api';
import type { CommandContext } from '../command/command';
import { SDKError } from '../errors/sdk-error';

describe('RoarApi', () => {
  it('throws SDKError when participantId is missing', () => {
    const contextWithoutParticipant: CommandContext = {
      baseUrl: 'https://api.example.com',
      auth: {
        getToken: async () => 'test-token',
      },
      participant: {
        participantId: '',
      },
    };

    try {
      new RoarApi(contextWithoutParticipant);
      expect.fail('Should have thrown SDKError');
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      expect((error as SDKError).code).toBe('INVALID_CONTEXT');
    }
  });

  it('creates client successfully when participantId is present', () => {
    const contextWithParticipant: CommandContext = {
      baseUrl: 'https://api.example.com',
      auth: {
        getToken: async () => 'test-token',
      },
      participant: {
        participantId: 'participant-123',
      },
    };

    const api = new RoarApi(contextWithParticipant);
    expect(api.client).toBeDefined();
  });
});
