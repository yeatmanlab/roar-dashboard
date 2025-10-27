import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { getStudentGradeLevel } from './getStudentGradeLevel';

vi.mock('@bdelab/roar-utils', () => ({
  getGrade: vi.fn((grade) => parseInt(grade)),
}));

describe('getStudentGradeLevel', () => {
  it('should extract numeric grade from student data ref structure', () => {
    const studentData = ref({
      studentData: {
        grade: 3,
      },
    });

    const result = getStudentGradeLevel(studentData);
    expect(result).toBe(3);
  });

  it('should extract numeric grade from student data structure', () => {
    const studentData = ref({
      studentData: {
        grade: 1,
      },
    });

    const result = getStudentGradeLevel(studentData);
    expect(result).toBe(1);
  });

  it('should handle cases where grade is not available', () => {
    const studentData = ref({
      studentData: {},
    });

    const result = getStudentGradeLevel(studentData);
    expect(result).toBe(NaN);
  });
});
