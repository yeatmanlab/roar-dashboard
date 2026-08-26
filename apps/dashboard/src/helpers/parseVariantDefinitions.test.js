import { describe, it, expect } from 'vitest';
import { parseVariantDefinitions } from './parseVariantDefinitions';

/** The accepted shape: one `{ variantName, params }` entry. */
const variant = (v) => JSON.stringify(v);

describe('parseVariantDefinitions', () => {
  it('returns the name and configurator rows, inferring each type from its value', () => {
    const text = variant({
      variantName: 'English-v7',
      params: { language: 'en', scoringVersion: 7, isAdaptive: true },
    });

    expect(parseVariantDefinitions(text)).toEqual([
      {
        variantName: 'English-v7',
        rows: [
          { name: 'language', type: 'string', value: 'en', isNew: true },
          { name: 'scoringVersion', type: 'number', value: 7, isNew: true },
          { name: 'isAdaptive', type: 'boolean', value: true, isNew: true },
        ],
      },
    ]);
  });

  it('accepts a one-element array, so an extract from a full file works unwrapped', () => {
    const text = JSON.stringify([{ variantName: 'English-v7', params: { language: 'en' } }]);
    expect(parseVariantDefinitions(text)[0].variantName).toBe('English-v7');
  });

  it('trims the variant name', () => {
    expect(parseVariantDefinitions(variant({ variantName: '  English-v7  ', params: {} }))[0].variantName).toBe(
      'English-v7',
    );
  });

  it('accepts a variant with no parameters', () => {
    expect(parseVariantDefinitions(variant({ variantName: 'Bare', params: {} }))).toEqual([
      { variantName: 'Bare', rows: [] },
    ]);
  });

  it('ignores unknown extra properties', () => {
    const text = variant({ variantName: 'Extra', params: { a: 1 }, somethingElse: 'ignored' });
    expect(parseVariantDefinitions(text)[0].rows).toEqual([{ name: 'a', type: 'number', value: 1, isNew: true }]);
  });

  describe('same-task requirement', () => {
    it('accepts several variants when they all belong to one task', () => {
      // Several assessments have all their variants on one task; this is also any
      // single-task subset of a larger set.
      const text = JSON.stringify([
        { variantName: 'English-Fixed-v3', params: { lng: 'en', userMode: 'fixed' } },
        { variantName: 'English-Adaptive-v5', params: { lng: 'en', userMode: 'adaptive' } },
      ]);

      const variants = parseVariantDefinitions(text);
      expect(variants.map((v) => v.variantName)).toEqual(['English-Fixed-v3', 'English-Adaptive-v5']);
    });

    it.each(['lng', 'language', 'task', 'taskName'])('rejects a file whose entries differ on %s', (key) => {
      // An assessment distributes its variants across tasks by these parameters, so entries
      // that disagree on any of them may belong to different tasks.
      const text = JSON.stringify([
        { variantName: 'First', params: { [key]: 'a' } },
        { variantName: 'Second', params: { [key]: 'b' } },
      ]);
      expect(() => parseVariantDefinitions(text)).toThrow(
        new RegExp(`belong to different tasks[\\s\\S]*"${key}" varies`),
      );
    });

    it('reports an unset routing key as (unset) rather than blank', () => {
      const text = JSON.stringify([
        { variantName: 'First', params: { lng: 'es' } },
        { variantName: 'Second', params: {} },
      ]);
      expect(() => parseVariantDefinitions(text)).toThrow(/\(unset\)/);
    });

    it('rejects an empty array', () => {
      expect(() => parseVariantDefinitions('[]')).toThrow(/no variants/i);
    });
  });

  describe('null and empty values', () => {
    it('drops null and undefined params, matching the seed', () => {
      // A parameter with no value is not a configuration choice, and nulls are common in
      // real variant definitions — roughly a third of the parameters in some assessments.
      const text = variant({ variantName: 'Sparse', params: { language: 'en', storyOption: null } });
      expect(parseVariantDefinitions(text)[0].rows).toEqual([
        { name: 'language', type: 'string', value: 'en', isNew: true },
      ]);
    });

    it('drops empty objects and arrays', () => {
      // Empty containers appear in real definitions (e.g. `catsToUpdate: {}`) — no
      // configuration, and the configurator has no way to represent them.
      const text = variant({ variantName: 'Empties', params: { catsToUpdate: {}, tags: [], keep: 1 } });
      expect(parseVariantDefinitions(text)[0].rows).toEqual([{ name: 'keep', type: 'number', value: 1, isNew: true }]);
    });

    it('rejects a non-empty nested object rather than dropping real configuration', () => {
      const text = variant({ variantName: 'Nested', params: { corpus: { practice: 'a' } } });
      expect(() => parseVariantDefinitions(text)).toThrow(/Variant: parameter "corpus" is a nested object/);
    });

    it('rejects a non-empty nested array', () => {
      const text = variant({ variantName: 'Nested', params: { blocks: [1, 2] } });
      expect(() => parseVariantDefinitions(text)).toThrow(/Variant: parameter "blocks" is a nested array/);
    });
  });

  describe('status', () => {
    it('returns a declared status', () => {
      const text = variant({ variantName: 'Published-v1', status: 'published', params: {} });
      expect(parseVariantDefinitions(text)[0].status).toBe('published');
    });

    it.each(['draft', 'published', 'deprecated'])('accepts %s', (status) => {
      expect(parseVariantDefinitions(variant({ variantName: 'X', status, params: {} }))[0].status).toBe(status);
    });

    it('omits status entirely when the definition declares none, so the caller supplies it', () => {
      // Absence has to be distinguishable from a value: the form falls back to its own
      // dropdown, and a hardcoded default here would silently override that selection.
      expect(parseVariantDefinitions(variant({ variantName: 'X', params: {} }))[0]).not.toHaveProperty('status');
    });

    it('treats an explicit null the same as absent', () => {
      expect(parseVariantDefinitions(variant({ variantName: 'X', status: null, params: {} }))[0]).not.toHaveProperty(
        'status',
      );
    });

    it('trims a declared status', () => {
      expect(parseVariantDefinitions(variant({ variantName: 'X', status: ' draft ', params: {} }))[0].status).toBe(
        'draft',
      );
    });

    it('rejects a status outside the contract enum, naming the accepted values', () => {
      expect(() => parseVariantDefinitions(variant({ variantName: 'X', status: 'live', params: {} }))).toThrow(
        /"status" must be one of draft, published, deprecated/,
      );
    });

    it('rejects a capitalised status rather than guessing', () => {
      // The contract's enum is lowercase and the API would 400 on this, so report it here.
      expect(() => parseVariantDefinitions(variant({ variantName: 'X', status: 'Published', params: {} }))).toThrow(
        /"status" must be one of/,
      );
    });

    it('rejects a non-string status', () => {
      expect(() => parseVariantDefinitions(variant({ variantName: 'X', status: 3, params: {} }))).toThrow(
        /"status" must be one of/,
      );
    });

    it('lets each variant in a batch declare its own status', () => {
      const text = JSON.stringify([
        { variantName: 'Live', status: 'published', params: { lng: 'en' } },
        { variantName: 'WorkInProgress', params: { lng: 'en' } },
        { variantName: 'Retired', status: 'deprecated', params: { lng: 'en' } },
      ]);
      expect(parseVariantDefinitions(text).map((v) => v.status)).toEqual(['published', undefined, 'deprecated']);
    });

    it('labels the offending entry in a batch', () => {
      const text = JSON.stringify([
        { variantName: 'Fine', status: 'draft', params: { lng: 'en' } },
        { variantName: 'Broken', status: 'nope', params: { lng: 'en' } },
      ]);
      expect(() => parseVariantDefinitions(text)).toThrow(/Variant 2: "status" must be one of/);
    });
  });

  describe('variantName validation', () => {
    it('rejects a name the API would reject, naming the offending value', () => {
      // Legacy Firestore names carried parentheses, em-dashes and accents; the contract
      // enforces IDENTIFIER_WITH_SPACES, so catch it here rather than as a backend 400.
      expect(() => parseVariantDefinitions(variant({ variantName: 'English (v7)', params: {} }))).toThrow(
        /"variantName" \(English \(v7\)\) must start with a letter/,
      );
      expect(() => parseVariantDefinitions(variant({ variantName: 'Morphology — adaptive', params: {} }))).toThrow(
        /must start with a letter/,
      );
      expect(() => parseVariantDefinitions(variant({ variantName: 'un-dígito-school', params: {} }))).toThrow(
        /must start with a letter/,
      );
    });

    it('rejects a name that does not start with a letter', () => {
      expect(() => parseVariantDefinitions(variant({ variantName: '7-english', params: {} }))).toThrow(
        /must start with a letter/,
      );
    });

    it('accepts hyphens, underscores, digits and spaces', () => {
      expect(parseVariantDefinitions(variant({ variantName: 'English v7_beta-2', params: {} }))[0].variantName).toBe(
        'English v7_beta-2',
      );
    });

    it('rejects a name over the length limit', () => {
      const text = variant({ variantName: `A${'b'.repeat(255)}`, params: {} });
      expect(() => parseVariantDefinitions(text)).toThrow(/255 characters or fewer/);
    });

    it('rejects a missing or blank name', () => {
      expect(() => parseVariantDefinitions(variant({ params: {} }))).toThrow(
        /Variant: "variantName" must be a non-empty string/,
      );
      expect(() => parseVariantDefinitions(variant({ variantName: '   ', params: {} }))).toThrow(
        /"variantName" must be a non-empty string/,
      );
    });
  });

  describe('structural errors', () => {
    it('throws on invalid JSON', () => {
      expect(() => parseVariantDefinitions('{not json')).toThrow(/not valid JSON/i);
    });

    it('throws when an entry is not an object', () => {
      expect(() => parseVariantDefinitions('"nope"')).toThrow(/must be an object with "variantName"/);
      expect(() => parseVariantDefinitions('null')).toThrow(/must be an object with "variantName"/);
      expect(() => parseVariantDefinitions('[[1, 2]]')).toThrow(/must be an object with "variantName"/);
    });

    it('labels the offending entry in a multi-variant file', () => {
      const text = JSON.stringify([
        { variantName: 'Fine', params: { lng: 'en', a: 1 } },
        { variantName: 'Broken', params: { lng: 'en', b: { nested: true } } },
      ]);
      expect(() => parseVariantDefinitions(text)).toThrow(/Variant 2: parameter "b" is a nested object/);
    });

    it('throws when params is missing or not a plain object', () => {
      expect(() => parseVariantDefinitions(variant({ variantName: 'X' }))).toThrow(/"params" must be an object/);
      expect(() => parseVariantDefinitions(variant({ variantName: 'X', params: [] }))).toThrow(
        /"params" must be an object/,
      );
      expect(() => parseVariantDefinitions(variant({ variantName: 'X', params: 'nope' }))).toThrow(
        /"params" must be an object/,
      );
    });
  });
});
