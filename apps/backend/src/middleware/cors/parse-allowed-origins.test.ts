import { describe, it, expect } from 'vitest';
import { logger } from '../../logger';
import { parseAllowedOrigins } from './parse-allowed-origins';

describe('parseAllowedOrigins', () => {
  it('parses comma-separated origins', () => {
    const result = parseAllowedOrigins('https://a.com,https://b.com');
    expect(result).toEqual(['https://a.com', 'https://b.com']);
  });

  it('trims whitespace around origins', () => {
    const result = parseAllowedOrigins('  https://a.com , https://b.com  ');
    expect(result).toEqual(['https://a.com', 'https://b.com']);
  });

  it('deduplicates origins', () => {
    const result = parseAllowedOrigins('https://a.com,https://a.com,https://b.com');
    expect(result).toEqual(['https://a.com', 'https://b.com']);
  });

  it('filters empty entries from trailing commas', () => {
    const result = parseAllowedOrigins('https://a.com,,,https://b.com,');
    expect(result).toEqual(['https://a.com', 'https://b.com']);
  });

  it('handles a single origin', () => {
    const result = parseAllowedOrigins('https://a.com');
    expect(result).toEqual(['https://a.com']);
  });

  describe('fallback to default', () => {
    it('falls back when undefined', () => {
      const result = parseAllowedOrigins(undefined);
      expect(result).toEqual(['https://localhost:5173']);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('falls back when empty string', () => {
      const result = parseAllowedOrigins('');
      expect(result).toEqual(['https://localhost:5173']);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('falls back when whitespace-only', () => {
      const result = parseAllowedOrigins('   ,  ,  ');
      expect(result).toEqual(['https://localhost:5173']);
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  it('does not log a warning when origins are provided', () => {
    parseAllowedOrigins('https://a.com');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
