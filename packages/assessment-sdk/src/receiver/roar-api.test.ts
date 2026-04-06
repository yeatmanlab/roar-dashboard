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

    expect(() => new RoarApi(contextWithoutParticipant)).toThrow(SDKError);
    expect(() => new RoarApi(contextWithoutParticipant)).toThrow(
      'participantId is required in CommandContext to create API client',
    );
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
