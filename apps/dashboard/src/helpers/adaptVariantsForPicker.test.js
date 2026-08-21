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
        publicName: 'ROAR - Word',
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

  it('preserves input order', () => {
    const variants = [
      { ...flatVariant, id: 'id-1' },
      { ...flatVariant, id: 'id-2' },
      { ...flatVariant, id: 'id-3' },
    ];
    const result = adaptVariantsForPicker(variants);
    expect(result.map((v) => v.id)).toEqual(['id-1', 'id-2', 'id-3']);
  });

  it('maps multiple variants across different tasks without grouping or deduping', () => {
    const variants = [
      { ...flatVariant, id: 'v1', taskId: 'task-a', taskName: 'Task A' },
      { ...flatVariant, id: 'v2', taskId: 'task-b', taskName: 'Task B' },
    ];
    const result = adaptVariantsForPicker(variants);
    expect(result).toHaveLength(2);
    expect(result[0].task.id).toBe('task-a');
    expect(result[1].task.id).toBe('task-b');
  });

  it('returns an empty array for empty or missing input', () => {
    expect(adaptVariantsForPicker([])).toEqual([]);
    expect(adaptVariantsForPicker()).toEqual([]);
    expect(adaptVariantsForPicker(null)).toEqual([]);
  });
});
