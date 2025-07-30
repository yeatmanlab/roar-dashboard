import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { getStudentGrade } from './getStudentGrade';

vi.mock('@bdelab/roar-utils', () => ({
  getGrade: vi.fn((grade) => parseInt(grade)),
}));

describe('getStudentGrade', () => {
  it('should extract numeric grade from student data ref structure', () => {
    const studentData = ref({
      studentData: {
        grade: 3,
      },
    });

    const result = getStudentGrade(studentData);
    expect(result).toBe(3);
  });

  it('should extract numeric grade from student data structure', () => {
    const studentData = ref({
      studentData: {
        grade: 1,
      },
    });

    const result = getStudentGrade(studentData);
    expect(result).toBe(1);
  });

  it('should handle cases where grade is not available', () => {
    const studentData = ref({
      studentData: {},
    });

    const result = getStudentGrade(studentData);
    expect(result).toBe(NaN);
  });
});
