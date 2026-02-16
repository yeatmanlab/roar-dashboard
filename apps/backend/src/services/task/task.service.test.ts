import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from './task.service';
import { Operator, type Condition } from './task.types';
import type { User } from '../../db/schema';

describe('TaskService', () => {
  let service: ReturnType<typeof TaskService>;

  beforeEach(() => {
    service = TaskService();
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
    });

    describe('comparison operators', () => {
      it('should handle EQUAL operator', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '3' });
        expect(service.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);
      });

      it('should handle NOT_EQUAL operator', () => {
        const user = createUser({ grade: '3' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.NOT_EQUAL, value: 5 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(service.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);
      });

      it('should handle LESS_THAN operator', () => {
        const user = createUser({ grade: '3' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.LESS_THAN, value: 5 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(service.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);

        const user3 = createUser({ grade: '7' });
        expect(service.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });

      it('should handle GREATER_THAN operator', () => {
        const user = createUser({ grade: '7' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.GREATER_THAN, value: 5 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(service.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);
      });

      it('should handle LESS_THAN_OR_EQUAL operator', () => {
        const condition: Condition = { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 5 };

        const user1 = createUser({ grade: '3' });
        expect(service.evaluateTaskVariantEligibility(user1, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(service.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(true);

        const user3 = createUser({ grade: '7' });
        expect(service.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });

      it('should handle GREATER_THAN_OR_EQUAL operator', () => {
        const condition: Condition = { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 5 };

        const user1 = createUser({ grade: '7' });
        expect(service.evaluateTaskVariantEligibility(user1, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(service.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(true);

        const user3 = createUser({ grade: '3' });
        expect(service.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });
    });

    describe('field types', () => {
      it('should handle string field comparisons', () => {
        const user = createUser({ statusEll: 'active' });
        const condition: Condition = { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle boolean field comparisons', () => {
        const user = createUser({ hispanicEthnicity: true });
        const condition: Condition = { field: 'studentData.hispanicEthnicity', op: Operator.EQUAL, value: true };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned when field is null', () => {
        const user = createUser({ grade: null });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return not assigned when field is undefined', () => {
        // Create user without setting statusFrl (effectively undefined in the condition data)
        const user = createUser({ statusFrl: null });
        const condition: Condition = { field: 'studentData.statusFrl', op: Operator.EQUAL, value: 'eligible' };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });
    });

    describe('grade conversion', () => {
      it('should convert Kindergarten grade to 0', () => {
        const user = createUser({ grade: 'Kindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert PreKindergarten grade to 0', () => {
        const user = createUser({ grade: 'PreKindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert TransitionalKindergarten grade to 0', () => {
        const user = createUser({ grade: 'TransitionalKindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert InfantToddler grade to 0', () => {
        const user = createUser({ grade: 'InfantToddler' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert Preschool grade to 0', () => {
        const user = createUser({ grade: 'Preschool' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert PostGraduate grade to 13', () => {
        const user = createUser({ grade: 'PostGraduate' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 13 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert numeric string grades correctly', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle grade comparison with string value in condition', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: '5' };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle grade comparison with Kindergarten string in condition', () => {
        const user = createUser({ grade: 'Kindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 'Kindergarten' };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned for invalid grade values', () => {
        // Use 'as unknown as User' to simulate invalid data that might come from external sources
        const user = createUser({ grade: 'InvalidGrade' as User['grade'] });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return not assigned when user grade is null', () => {
        const user = createUser({ grade: null });
        const condition: Condition = { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });
    });

    describe('composite conditions - AND', () => {
      it('should return assigned when all AND conditions pass', () => {
        const user = createUser({ grade: '5', statusEll: 'active' });
        const condition: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned when any AND condition fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const condition: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return assigned for empty AND conditions array', () => {
        const user = createUser();
        const condition: Condition = { op: 'AND', conditions: [] };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });
    });

    describe('composite conditions - OR', () => {
      it('should return assigned when any OR condition passes', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const condition: Condition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned when all OR conditions fail', () => {
        const user = createUser({ grade: '3', statusEll: 'inactive' });
        const condition: Condition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return not assigned for empty OR conditions array', () => {
        const user = createUser();
        const condition: Condition = { op: 'OR', conditions: [] };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });
    });

    describe('nested composite conditions', () => {
      it('should handle nested AND within OR', () => {
        const user = createUser({ grade: '5', statusEll: 'active', statusIep: 'yes' });
        const condition: Condition = {
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
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle nested OR within AND', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive', statusIep: 'yes' });
        const condition: Condition = {
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
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle complex grade range conditions', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 },
            { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 8 },
          ],
        };
        expect(service.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '2' });
        expect(service.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);

        const user3 = createUser({ grade: '9' });
        expect(service.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });
    });

    describe('complex eligibility and optionality', () => {
      it('should handle complex composite conditions for both assignment and optionality', () => {
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

      it('should return not assigned with complex conditions when user does not match', () => {
        const user = createUser({ grade: '2', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 },
            { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 8 },
          ],
        };
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = service.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: false, isOptional: false });
      });
    });
  });
});
