import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import StudentCsvUploader from './index.vue';

vi.mock('@/composables/mutations/useStudentRegistrationMutation', () => ({
  default: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/utils/csv-helpers.util', () => ({
  generateColumns: vi.fn(),
}));

vi.mock('@/services/student.service', () => ({
  transformStudentData: vi.fn(),
}));

describe('StudentCsvUploader', () => {
  it('should render correctly', () => {
    const wrapper = mount(StudentCsvUploader);
    expect(wrapper.exists()).toBe(true);
  });
});
