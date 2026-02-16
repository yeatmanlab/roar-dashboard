import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from './task.service';
import { Operator, type Condition, type FieldCondition, type CompositeCondition } from './task.types';
import type { User } from '../../db/schema';

describe('TaskService', () => {
  let service: ReturnType<typeof TaskService>;

  beforeEach(() => {
    service = TaskService();
  });

  describe('evaluateCondition', () => {
    describe('SelectAllCondition', () => {
      it('should return true for SelectAllCondition (true)', () => {
        const userData = { studentData: { grade: 5 } };
        expect(service.evaluateCondition(userData, true)).toBe(true);
      });
    });

    describe('FieldCondition - EQUAL operator', () => {
      it('should return true when field equals expected value', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when field does not equal expected value', () => {
        const userData = { studentData: { grade: 3 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });

      it('should handle string comparisons', () => {
        const userData = { studentData: { statusEll: 'active' } };
        const condition: FieldCondition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should handle boolean comparisons', () => {
        const userData = { studentData: { hispanicEthnicity: true } };
        const condition: FieldCondition = {
          field: 'studentData.hispanicEthnicity',
          op: Operator.EQUAL,
          value: true,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });
    });

    describe('FieldCondition - NOT_EQUAL operator', () => {
      it('should return true when field does not equal expected value', () => {
        const userData = { studentData: { grade: 3 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.NOT_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when field equals expected value', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.NOT_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });
    });

    describe('FieldCondition - LESS_THAN operator', () => {
      it('should return true when field is less than expected value', () => {
        const userData = { studentData: { grade: 3 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when field is not less than expected value', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });

      it('should return false when field is greater than expected value', () => {
        const userData = { studentData: { grade: 7 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });
    });

    describe('FieldCondition - GREATER_THAN operator', () => {
      it('should return true when field is greater than expected value', () => {
        const userData = { studentData: { grade: 7 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when field is not greater than expected value', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });
    });

    describe('FieldCondition - LESS_THAN_OR_EQUAL operator', () => {
      it('should return true when field is less than expected value', () => {
        const userData = { studentData: { grade: 3 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN_OR_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return true when field equals expected value', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN_OR_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when field is greater than expected value', () => {
        const userData = { studentData: { grade: 7 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN_OR_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });
    });

    describe('FieldCondition - GREATER_THAN_OR_EQUAL operator', () => {
      it('should return true when field is greater than expected value', () => {
        const userData = { studentData: { grade: 7 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return true when field equals expected value', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when field is less than expected value', () => {
        const userData = { studentData: { grade: 3 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });
    });

    describe('FieldCondition - grade string conversion', () => {
      it('should convert "Kindergarten" (DB enum value) to 0', () => {
        const userData = { studentData: { grade: 0 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 'Kindergarten', // Exact DB enum value (PascalCase)
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should convert numeric string grades', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: '5',
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should handle grade comparisons with string values', () => {
        const userData = { studentData: { grade: 3 } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: '3',
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });
    });

    describe('FieldCondition - null/undefined handling', () => {
      it('should return false when field is null', () => {
        const userData = { studentData: { grade: null } };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });

      it('should return false when field is undefined', () => {
        const userData = { studentData: {} };
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });

      it('should return false when nested path does not exist', () => {
        const userData = {};
        const condition: FieldCondition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });
    });

    describe('CompositeCondition - AND', () => {
      it('should return true when all conditions pass', () => {
        const userData = { studentData: { grade: 5, statusEll: 'active' } };
        const condition: CompositeCondition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when any condition fails', () => {
        const userData = { studentData: { grade: 5, statusEll: 'inactive' } };
        const condition: CompositeCondition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });

      it('should return true for empty conditions array', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: CompositeCondition = {
          op: 'AND',
          conditions: [],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });
    });

    describe('CompositeCondition - OR', () => {
      it('should return true when any condition passes', () => {
        const userData = { studentData: { grade: 5, statusEll: 'inactive' } };
        const condition: CompositeCondition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should return false when all conditions fail', () => {
        const userData = { studentData: { grade: 3, statusEll: 'inactive' } };
        const condition: CompositeCondition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });

      it('should return false for empty conditions array', () => {
        const userData = { studentData: { grade: 5 } };
        const condition: CompositeCondition = {
          op: 'OR',
          conditions: [],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(false);
      });
    });

    describe('nested CompositeConditions', () => {
      it('should handle nested AND within OR', () => {
        const userData = { studentData: { grade: 5, statusEll: 'active', statusIep: 'yes' } };
        const condition: CompositeCondition = {
          op: 'OR',
          conditions: [
            {
              op: 'AND',
              conditions: [
                { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
                { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
              ],
            },
            { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'no' },
          ],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });

      it('should handle nested OR within AND', () => {
        const userData = { studentData: { grade: 5, statusEll: 'inactive', statusIep: 'yes' } };
        const condition: CompositeCondition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            {
              op: 'OR',
              conditions: [
                { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
                { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'yes' },
              ],
            },
          ],
        };
        expect(service.evaluateCondition(userData, condition)).toBe(true);
      });
    });
  });

  describe('mapUserToConditionData', () => {
    it('should map user fields to condition data structure', () => {
      const user = {
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: '5',
        statusEll: 'active',
        statusIep: 'yes',
        statusFrl: 'eligible',
        dob: '2015-05-15',
        gender: 'female',
        race: 'asian',
        hispanicEthnicity: true,
        homeLanguage: 'spanish',
      } as unknown as User;

      const result = service.mapUserToConditionData(user);

      expect(result).toEqual({
        studentData: {
          grade: 5,
          statusEll: 'active',
          statusIep: 'yes',
          statusFrl: 'eligible',
          dob: '2015-05-15',
          gender: 'female',
          race: 'asian',
          hispanicEthnicity: true,
          homeLanguage: 'spanish',
        },
      });
    });

    it('should convert Kindergarten grade to 0', () => {
      const user = {
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: 'Kindergarten', // Grade enum value from DB
      } as unknown as User;

      const result = service.mapUserToConditionData(user);

      expect(result.studentData.grade).toBe(0);
    });

    it('should convert PreKindergarten grade to 0 (all early childhood grades map to 0)', () => {
      const user = {
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: 'PreKindergarten', // Grade enum value from DB
      } as unknown as User;

      const result = service.mapUserToConditionData(user);

      // All early childhood grades (infant through kindergarten) map to 0
      expect(result.studentData.grade).toBe(0);
    });

    it('should convert TransitionalKindergarten grade to 0', () => {
      const user = {
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: 'TransitionalKindergarten', // Grade enum value from DB
      } as unknown as User;

      const result = service.mapUserToConditionData(user);

      expect(result.studentData.grade).toBe(0);
    });

    it('should return null for invalid grade values not in the DB enum', () => {
      // Grades come directly from the database enum, so non-enum values return null
      const user = {
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: 'InvalidGrade', // Not a valid DB enum value
      } as unknown as User;

      const result = service.mapUserToConditionData(user);

      expect(result.studentData.grade).toBeNull();
    });

    it('should handle null grade', () => {
      const user = {
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: null,
      } as unknown as User;

      const result = service.mapUserToConditionData(user);

      expect(result.studentData.grade).toBeNull();
    });

    it('should handle null values for optional fields', () => {
      const user = {
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: null,
        statusEll: null,
        statusIep: null,
        statusFrl: null,
        dob: null,
        gender: null,
        race: null,
        hispanicEthnicity: null,
        homeLanguage: null,
      } as unknown as User;

      const result = service.mapUserToConditionData(user);

      expect(result).toEqual({
        studentData: {
          grade: null,
          statusEll: null,
          statusIep: null,
          statusFrl: null,
          dob: null,
          gender: null,
          race: null,
          hispanicEthnicity: null,
          homeLanguage: null,
        },
      });
    });
  });

  describe('evaluateTaskVariantEligibility', () => {
    const createUser = (overrides: Partial<User> = {}): User =>
      ({
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: '5',
        statusEll: 'active',
        statusIep: null,
        statusFrl: null,
        dob: null,
        gender: null,
        race: null,
        hispanicEthnicity: null,
        homeLanguage: null,
        ...overrides,
      }) as unknown as User;

    describe('assignment (assigned_if) evaluation', () => {
      it('should return isAssigned=true when conditionsAssignment is null (assigned to all)', () => {
        const user = createUser();
        const result = service.evaluateTaskVariantEligibility(user, null, null);
        expect(result.isAssigned).toBe(true);
      });

      it('should return isAssigned=true when conditionsAssignment passes', () => {
        const user = createUser({ grade: '5' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, null);
        expect(result.isAssigned).toBe(true);
      });

      it('should return isAssigned=false when conditionsAssignment fails', () => {
        const user = createUser({ grade: '2' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, null);
        expect(result.isAssigned).toBe(false);
      });

      it('should return isAssigned=true when conditionsAssignment is SelectAllCondition (true)', () => {
        const user = createUser();
        const result = service.evaluateTaskVariantEligibility(user, true, null);
        expect(result.isAssigned).toBe(true);
      });

      it('should return assigned and required when SelectAllCondition for assignment but optional_if fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = service.evaluateTaskVariantEligibility(user, true, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: false });
      });
    });

    describe('optional (optional_if) evaluation', () => {
      it('should return isOptional=false when conditionsRequirements is null (required for all)', () => {
        const user = createUser();
        const result = service.evaluateTaskVariantEligibility(user, null, null);
        expect(result.isOptional).toBe(false);
      });

      it('should return isOptional=true when conditionsRequirements passes', () => {
        const user = createUser({ grade: '5' });
        const conditionsRequirements: Condition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        const result = service.evaluateTaskVariantEligibility(user, null, conditionsRequirements);
        expect(result.isOptional).toBe(true);
      });

      it('should return isOptional=false when conditionsRequirements fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = service.evaluateTaskVariantEligibility(user, null, conditionsRequirements);
        expect(result.isOptional).toBe(false);
      });

      it('should not evaluate optional_if when user is not assigned (short-circuit)', () => {
        const user = createUser({ grade: '2' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        // This condition would pass, but should not be evaluated since user is not assigned
        const conditionsRequirements: Condition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN,
          value: 5,
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result.isAssigned).toBe(false);
        expect(result.isOptional).toBe(false);
      });
    });

    describe('combined scenarios', () => {
      it('should return assigned and required when both conditions are null', () => {
        const user = createUser();
        const result = service.evaluateTaskVariantEligibility(user, null, null);
        expect(result).toEqual({ isAssigned: true, isOptional: false });
      });

      it('should return assigned and optional when assignment passes and optional_if passes', () => {
        const user = createUser({ grade: '5', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: true });
      });

      it('should return assigned and required when assignment passes but optional_if fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: false });
      });

      it('should return not assigned when assignment fails regardless of optional_if', () => {
        const user = createUser({ grade: '2', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        // This would pass if evaluated
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: false, isOptional: false });
      });

      it('should handle complex composite conditions', () => {
        const user = createUser({ grade: '5', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 },
            { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 8 },
          ],
        };
        const conditionsRequirements: Condition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
            { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'yes' },
          ],
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: true });
      });
    });
  });
});
