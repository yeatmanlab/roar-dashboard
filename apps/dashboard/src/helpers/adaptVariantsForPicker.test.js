import { describe, it, expect } from 'vitest';
import { adaptVariantsForPicker } from './adaptVariantsForPicker';

const flatVariant = {
  id: '00000000-0000-0000-0000-0000000000a1',
  taskId: '00000000-0000-0000-0000-0000000000b1',
  name: 'default',
  status: 'published',
  taskName: 'ROAR - Word',
  taskSlug: 'swr',
  taskImage: 'https://img/swr.png',
  parameters: [
    { name: 'corpus', value: 'aoe' },
    { name: 'numItems', value: 84 },
  ],
};

describe('adaptVariantsForPicker', () => {
  it('maps the flat shape into the nested picker shape', () => {
    const [nested] = adaptVariantsForPicker([flatVariant]);

    expect(nested).toEqual({
      id: flatVariant.id,
      variant: {
        id: flatVariant.id,
        name: 'default',
        params: { corpus: 'aoe', numItems: 84 },
      },
      task: {
        id: flatVariant.taskId,
        name: 'ROAR - Word',
        studentFacingName: 'ROAR - Word',
        image: 'https://img/swr.png',
        slug: 'swr',
      },
    });
  });

  it('converts the parameters array to an object and defaults to {} when absent', () => {
    const [withParams] = adaptVariantsForPicker([flatVariant]);
    expect(withParams.variant.params).toEqual({ corpus: 'aoe', numItems: 84 });

    const [noParams] = adaptVariantsForPicker([{ ...flatVariant, parameters: undefined }]);
    expect(noParams.variant.params).toEqual({});
  });

  it('omits per-assignment conditions (set later by the form)', () => {
    const [nested] = adaptVariantsForPicker([flatVariant]);
    expect(nested.variant.conditions).toBeUndefined();
  });

  it('returns an empty array for empty or missing input', () => {
    expect(adaptVariantsForPicker([])).toEqual([]);
    expect(adaptVariantsForPicker()).toEqual([]);
    expect(adaptVariantsForPicker(null)).toEqual([]);
  });
});
