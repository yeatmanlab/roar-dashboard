import { describe, it, expect } from 'vitest';
import { adaptBundlesForPicker } from './adaptBundlesForPicker';

const flatBundle = {
  id: '00000000-0000-0000-0000-0000000000c1',
  slug: 'core-bundle',
  name: 'Core Bundle',
  description: 'A core set of tasks',
  image: 'https://img/bundle.png',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: null,
  taskVariants: [
    {
      taskVariantId: '00000000-0000-0000-0000-0000000000a1',
      taskSlug: 'swr',
      taskName: 'ROAR - Word',
      taskVariantName: 'default',
      sortOrder: 0,
      taskId: '00000000-0000-0000-0000-0000000000b1',
    },
    {
      taskVariantId: '00000000-0000-0000-0000-0000000000a2',
      taskSlug: 'pa',
      taskName: 'ROAR - Phoneme',
      taskVariantName: 'default',
      sortOrder: 1,
      taskId: '00000000-0000-0000-0000-0000000000b2',
    },
  ],
};

describe('adaptBundlesForPicker', () => {
  it('maps the flat bundle shape into the nested picker shape', () => {
    const [nested] = adaptBundlesForPicker([flatBundle]);

    expect(nested).toEqual({
      id: flatBundle.id,
      data: {
        name: 'Core Bundle',
        publicName: 'Core Bundle',
        image: 'https://img/bundle.png',
        variants: [
          { taskId: '00000000-0000-0000-0000-0000000000b1', variantId: '00000000-0000-0000-0000-0000000000a1' },
          { taskId: '00000000-0000-0000-0000-0000000000b2', variantId: '00000000-0000-0000-0000-0000000000a2' },
        ],
      },
    });
  });

  it('maps each taskVariant to { taskId, variantId } using the backend variant id', () => {
    const [nested] = adaptBundlesForPicker([flatBundle]);
    // variantId must come from taskVariantId so it matches allVariants[].id
    expect(nested.data.variants[0].variantId).toBe(flatBundle.taskVariants[0].taskVariantId);
    // taskId must come from the embedded taskId so it matches the _groupBy('task.id') key
    expect(nested.data.variants[0].taskId).toBe(flatBundle.taskVariants[0].taskId);
  });

  it('falls back to name for publicName (no publicName in the backend schema)', () => {
    const [nested] = adaptBundlesForPicker([flatBundle]);
    expect(nested.data.publicName).toBe(flatBundle.name);
  });

  it('defaults variants to an empty array when taskVariants is absent', () => {
    const [nested] = adaptBundlesForPicker([{ ...flatBundle, taskVariants: undefined }]);
    expect(nested.data.variants).toEqual([]);
  });

  it('preserves input order', () => {
    const bundles = [
      { ...flatBundle, id: 'id-1' },
      { ...flatBundle, id: 'id-2' },
      { ...flatBundle, id: 'id-3' },
    ];
    const result = adaptBundlesForPicker(bundles);
    expect(result.map((b) => b.id)).toEqual(['id-1', 'id-2', 'id-3']);
  });

  it('returns an empty array for empty or missing input', () => {
    expect(adaptBundlesForPicker([])).toEqual([]);
    expect(adaptBundlesForPicker()).toEqual([]);
    expect(adaptBundlesForPicker(null)).toEqual([]);
  });
});
