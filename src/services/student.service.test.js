import { validateStudent, transformStudentData } from './student.service';
import * as csvHelpers from '@/utils/csv-helpers.util';

vi.mock('@/utils/csv-helpers.util', () => ({
  isEmailValid: vi.fn(),
  isPasswordValid: vi.fn(),
}));

describe('student.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateStudent', () => {
    it('should validate a student using email authentication', () => {
      csvHelpers.isEmailValid.mockReturnValue(true);
      csvHelpers.isPasswordValid.mockReturnValue(true);

      const student = {
        email: 'test@example.com',
        password: 'password123',
        grade: '5',
        dob: '2010-01-01',
      };

      const result = validateStudent(student, true, true);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate a student using username authentication', () => {
      csvHelpers.isPasswordValid.mockReturnValue(true);

      const student = {
        username: 'testuser',
        password: 'password123',
        grade: '5',
        dob: '2010-01-01',
      };

      const result = validateStudent(student, false, true);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return validation errors for missing required fields', () => {
      csvHelpers.isEmailValid.mockReturnValue(false);
      csvHelpers.isPasswordValid.mockReturnValue(false);

      const student = {
        email: 'invalid-email',
        password: 'short',
      };

      const result = validateStudent(student, true, true);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Email is improperly formatted');
      expect(result.errors).toContain('Grade is required');
      expect(result.errors).toContain('Date of Birth is required');
      expect(result.errors).toContain('Password must be at least 6 characters long and contain at least one letter');
    });

    it('should check organization requirements when not using org picker', () => {
      csvHelpers.isEmailValid.mockReturnValue(true);
      csvHelpers.isPasswordValid.mockReturnValue(true);

      const student = {
        email: 'test@example.com',
        password: 'password123',
        grade: '5',
        dob: '2010-01-01',
      };

      const result = validateStudent(student, true, false);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('District, School, or Group is required');
    });
  });

  describe('transformStudentData', () => {
    it('should transform student data correctly', async () => {
      const rawStudent = {
        username: 'testuser',
        password: 'password123',
        grade: '5',
        dob: '2010-01-01',
        first: 'Test',
        last: 'User',
        gender: 'Male',
        race: 'Asian, White',
        notes: 'Some notes',
      };

      const mappedColumns = {
        required: { username: 'username', password: 'password', grade: 'grade', dob: 'dob' },
        names: { first: 'first', last: 'last' },
        demographics: { gender: 'gender', race: 'race' },
        optional: { notes: 'notes' },
        organizations: {},
      };

      const selectedOrgs = {
        districts: [{ id: 'district1', name: 'District 1' }],
        schools: [{ id: 'school1', name: 'School 1' }],
        classes: [],
        groups: [],
      };

      const result = await transformStudentData(rawStudent, mappedColumns, false, selectedOrgs);

      expect(result.email).toBe('testuser@roar-auth.com');
      expect(result.password).toBe('password123');
      expect(result.userData.grade).toBe('5');
      expect(result.userData.dob).toBe('2010-01-01');
      expect(result.userData.name.first).toBe('Test');
      expect(result.userData.name.last).toBe('User');
      expect(result.userData.gender).toBe('Male');
      expect(result.userData.race).toEqual(['Asian', 'White']);
      expect(result.userData.notes).toBe('Some notes');
      expect(result.userData.districts.id).toBe('district1');
      expect(result.userData.schools.id).toBe('school1');
    });
  });
});
