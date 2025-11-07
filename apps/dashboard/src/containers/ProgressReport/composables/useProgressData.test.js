import { describe, it, expect } from 'vitest';
import { ref, computed } from 'vue';
import { useProgressData } from './useProgressData';

describe('useProgressData', () => {
  it('should return empty array when assignment data is null', () => {
    const assignmentData = ref(null);
    const schoolNameDictionary = computed(() => ({}));

    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value).toEqual([]);
  });

  it('should transform assignment data into progress data', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 3 },
          assessments: [
            { taskId: 'swr', completedOn: '2023-01-01' },
            { taskId: 'pa', startedOn: '2023-01-02' },
          ],
        },
        user: {
          username: 'student1',
          email: 'student1@test.com',
          userId: 'user1',
          name: { first: 'John', last: 'Doe' },
          assessmentPid: 'PID123',
          schools: { current: ['school1'] },
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({
      school1: 'Test School',
    }));

    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value).toHaveLength(1);
    expect(computedProgressData.value[0]).toMatchObject({
      user: {
        username: 'student1',
        email: 'student1@test.com',
        userId: 'user1',
        firstName: 'John',
        lastName: 'Doe',
        grade: '3',
        assessmentPid: 'PID123',
        schoolName: 'Test School',
      },
      routeParams: {
        userId: 'user1',
      },
      launchTooltip: 'View assessment portal for John',
    });
  });

  it('should handle completed assessment status', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 3 },
          assessments: [{ taskId: 'swr', completedOn: '2023-01-01' }],
        },
        user: {
          username: 'student1',
          userId: 'user1',
          name: { first: 'John' },
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({}));
    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value[0].progress.swr).toMatchObject({
      value: 'completed',
      icon: 'pi pi-check',
      severity: 'success',
      tags: expect.stringContaining('Completed'),
    });
  });

  it('should handle started assessment status', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 3 },
          assessments: [{ taskId: 'pa', startedOn: '2023-01-02' }],
        },
        user: {
          username: 'student1',
          userId: 'user1',
          name: { first: 'John' },
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({}));
    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value[0].progress.pa).toMatchObject({
      value: 'started',
      icon: 'pi pi-spinner-dotted',
      severity: 'warning',
      tags: expect.stringContaining('Started'),
    });
  });

  it('should handle assigned assessment status', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 3 },
          assessments: [{ taskId: 'sre' }],
        },
        user: {
          username: 'student1',
          userId: 'user1',
          name: { first: 'John' },
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({}));
    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value[0].progress.sre).toMatchObject({
      value: 'assigned',
      icon: 'pi pi-book',
      severity: 'danger',
      tags: expect.stringContaining('Assigned'),
    });
  });

  it('should handle optional assessment status', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 3 },
          assessments: [{ taskId: 'vocab', optional: true }],
        },
        user: {
          username: 'student1',
          userId: 'user1',
          name: { first: 'John' },
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({}));
    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value[0].progress.vocab).toMatchObject({
      value: 'optional',
      icon: 'pi pi-question',
      severity: 'info',
      tags: expect.stringContaining('Optional'),
    });
  });

  it('should handle missing school name', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 3 },
          assessments: [],
        },
        user: {
          username: 'student1',
          userId: 'user1',
          name: { first: 'John' },
          schools: { current: ['nonexistent'] },
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({}));
    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value[0].user.schoolName).toBe(undefined);
  });

  it('should use username in launch tooltip when first name is missing', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 3 },
          assessments: [],
        },
        user: {
          username: 'student1',
          userId: 'user1',
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({}));
    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(computedProgressData.value[0].launchTooltip).toBe('View assessment portal for student1');
  });

  it('should handle multiple assessments per student', () => {
    const assignmentData = ref([
      {
        assignment: {
          userData: { grade: 4 },
          assessments: [
            { taskId: 'swr', completedOn: '2023-01-01' },
            { taskId: 'pa', startedOn: '2023-01-02' },
            { taskId: 'sre' },
          ],
        },
        user: {
          username: 'student1',
          userId: 'user1',
          name: { first: 'Jane' },
        },
      },
    ]);

    const schoolNameDictionary = computed(() => ({}));
    const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

    expect(Object.keys(computedProgressData.value[0].progress)).toHaveLength(3);
    expect(computedProgressData.value[0].progress.swr.value).toBe('completed');
    expect(computedProgressData.value[0].progress.pa.value).toBe('started');
    expect(computedProgressData.value[0].progress.sre.value).toBe('assigned');
  });
});
