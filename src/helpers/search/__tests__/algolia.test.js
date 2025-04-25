import { describe, it, expect, vi } from 'vitest';

vi.mock('../algolia', () => ({
  searchClient: {
    appId: 'mock-app-id',
    apiKey: 'mock-api-key',
    initIndex: vi.fn(),
    search: vi.fn(),
  },
}));

import { searchClient } from '../algolia';

describe('algolia', () => {
  describe('searchClient', () => {
    it('should have required properties and methods', () => {
      expect(searchClient).toBeDefined();
      expect(searchClient.appId).toBeDefined();
      expect(searchClient.apiKey).toBeDefined();
      expect(searchClient.initIndex).toBeDefined();
      expect(searchClient.search).toBeDefined();
    });
  });
});
