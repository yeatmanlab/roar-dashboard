import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';

// userCan defaults to false (no launch column); Permissions and task display
// names are stubbed so the composable can be exercised in isolation.
vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({ userCan: () => false }),
}));
vi.mock('@bdelab/roar-firekit', () => ({
  Permissions: { Tasks: { LAUNCH: 'tasks.launch' } },
}));
vi.mock('@/helpers/reports.js', () => ({
  taskDisplayNames: {},
}));

import { useProgressColumns } from './useProgressColumns';

const buildStudents = () =>
  ref([{ user: { username: 'student1', email: 's1@test.com', firstName: 'John', lastName: 'Doe', grade: '3' } }]);

// Intentionally out of display order so the composable's ordering is exercised.
const buildTasks = () =>
  ref([
    { taskId: 't-mep', taskSlug: 'mep', taskName: 'MEP', orderIndex: 3 },
    { taskId: 't-pa', taskSlug: 'pa', taskName: 'PA', orderIndex: 2 },
    { taskId: 't-swr', taskSlug: 'swr', taskName: 'SWR', orderIndex: 0 },
    { taskId: 't-sre', taskSlug: 'sre', taskName: 'SRE', orderIndex: 1 },
  ]);

const tasksDictionary = ref({ swr: { nameSimple: 'Sight Words' } });
const administrationData = ref({ dateClosed: null });
const districtSchools = ref([{ id: 'sch1', name: 'School One' }]);

const fieldsOf = (cols) => cols.map((c) => c.field).filter(Boolean);

const buildColumns = (orgType, authStore, isLoading = ref(false)) =>
  useProgressColumns(
    administrationData,
    buildStudents(),
    buildTasks(),
    tasksDictionary,
    districtSchools,
    authStore,
    orgType,
    isLoading,
  ).progressReportColumns;

describe('useProgressColumns', () => {
  it('returns an empty array while the task dictionary is loading', () => {
    const columns = buildColumns('school', { isUserSuperAdmin: false }, ref(true));
    expect(columns.value).toEqual([]);
  });

  it('orders priority tasks (swr, sre, pa) before the rest, using UUID field paths', () => {
    const columns = buildColumns('school', { isUserSuperAdmin: false });
    const taskCols = columns.value.filter((c) => c.dataType === 'progress').map((c) => c.field);
    expect(taskCols).toEqual([
      'progress.t-swr.value',
      'progress.t-sre.value',
      'progress.t-pa.value',
      'progress.t-mep.value',
    ]);
  });

  it('uses the dictionary nameSimple for the header, falling back to the API task name', () => {
    const columns = buildColumns('school', { isUserSuperAdmin: false });
    const progressCols = columns.value.filter((c) => c.dataType === 'progress');
    expect(progressCols.find((c) => c.field === 'progress.t-swr.value').header).toBe('Sight Words');
    expect(progressCols.find((c) => c.field === 'progress.t-mep.value').header).toBe('MEP');
  });

  it('includes user identity columns when present, but not PID or School for a non-district educator', () => {
    const fields = fieldsOf(buildColumns('school', { isUserSuperAdmin: false }).value);
    expect(fields).toEqual(
      expect.arrayContaining(['user.username', 'user.email', 'user.firstName', 'user.lastName', 'user.grade']),
    );
    expect(fields).not.toContain('user.assessmentPid');
    expect(fields).not.toContain('user.schoolName');
  });

  it('adds the PID column for super admins', () => {
    const fields = fieldsOf(buildColumns('school', { isUserSuperAdmin: true }).value);
    expect(fields).toContain('user.assessmentPid');
  });

  it('adds the school column with multiselect options for district reports', () => {
    const columns = buildColumns('district', { isUserSuperAdmin: false });
    const schoolCol = columns.value.find((c) => c.field === 'user.schoolName');
    expect(schoolCol).toBeDefined();
    expect(schoolCol.multiSelectOptions).toEqual(['School One']);
  });
});
