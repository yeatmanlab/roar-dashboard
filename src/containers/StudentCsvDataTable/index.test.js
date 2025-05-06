import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import StudentCsvDataTable from './index.vue';

vi.mock('@/utils/csv-helpers.util', () => ({
  generateColumns: vi.fn(),
  findMappedColumn: vi.fn(),
}));

describe('StudentCsvDataTable', () => {
  it('should render correctly', () => {
    const wrapper = mount(StudentCsvDataTable, {
      props: {
        students: [],
        mappings: {},
      },
    });
    expect(wrapper.exists()).toBe(true);
  });
});
