import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useProgressData } from './useProgressData';

const buildStudents = (progress, userOverrides = {}) =>
  ref([
    {
      user: {
        userId: 'user1',
        assessmentPid: 'PID123',
        username: 'student1',
        email: 'student1@test.com',
        firstName: 'John',
        lastName: 'Doe',
        grade: '3',
        schoolName: 'Test School',
        ...userOverrides,
      },
      progress,
    },
  ]);

describe('useProgressData', () => {
  it('returns an empty array when student data is null', () => {
    const { computedProgressData } = useProgressData(ref(null));
    expect(computedProgressData.value).toEqual([]);
  });

  it('maps a student row through to the table shape', () => {
    const students = buildStudents({
      't-swr': { status: 'completed-required', startedAt: null, completedAt: '2023-01-01T00:00:00.000Z' },
    });

    const { computedProgressData } = useProgressData(students);

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
      routeParams: { userId: 'user1' },
      launchTooltip: 'View assessment portal for John',
    });
  });

  it('maps completed-required to the completed descriptor', () => {
    const { computedProgressData } = useProgressData(buildStudents({ 't-swr': { status: 'completed-required' } }));

    expect(computedProgressData.value[0].progress['t-swr']).toMatchObject({
      value: 'completed',
      icon: 'pi pi-check',
      severity: 'success',
      tags: expect.stringContaining('Completed'),
    });
  });

  it('maps started-required to the started descriptor', () => {
    const { computedProgressData } = useProgressData(buildStudents({ 't-pa': { status: 'started-required' } }));

    expect(computedProgressData.value[0].progress['t-pa']).toMatchObject({
      value: 'started',
      icon: 'pi pi-spinner-dotted',
      severity: 'warning',
      tags: expect.stringContaining('Started'),
    });
  });

  it('maps assigned-required to the assigned descriptor', () => {
    const { computedProgressData } = useProgressData(buildStudents({ 't-sre': { status: 'assigned-required' } }));

    expect(computedProgressData.value[0].progress['t-sre']).toMatchObject({
      value: 'assigned',
      icon: 'pi pi-book',
      severity: 'danger',
      tags: expect.stringContaining('Assigned'),
    });
  });

  it('maps every optional status (assigned/started/completed) to the optional descriptor', () => {
    // Optional wins over the progress stage — all three optional variants collapse to OPTIONAL,
    // including completed-optional (a completed-but-optional task still shows "Optional").
    for (const status of ['assigned-optional', 'started-optional', 'completed-optional']) {
      const { computedProgressData } = useProgressData(buildStudents({ 't-vocab': { status } }));

      expect(computedProgressData.value[0].progress['t-vocab']).toMatchObject({
        value: 'optional',
        icon: 'pi pi-question',
        severity: 'info',
        tags: expect.stringContaining('Optional'),
      });
    }
  });

  it('falls back to username in the launch tooltip when first name is missing', () => {
    const { computedProgressData } = useProgressData(buildStudents({}, { firstName: null }));

    expect(computedProgressData.value[0].launchTooltip).toBe('View assessment portal for student1');
  });

  it('maps multiple tasks per student', () => {
    const { computedProgressData } = useProgressData(
      buildStudents({
        't-swr': { status: 'completed-required' },
        't-pa': { status: 'started-required' },
        't-sre': { status: 'assigned-required' },
      }),
    );

    expect(Object.keys(computedProgressData.value[0].progress)).toHaveLength(3);
    expect(computedProgressData.value[0].progress['t-swr'].value).toBe('completed');
    expect(computedProgressData.value[0].progress['t-pa'].value).toBe('started');
    expect(computedProgressData.value[0].progress['t-sre'].value).toBe('assigned');
  });
});
