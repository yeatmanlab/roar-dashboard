import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// userCan is configurable per-test (defaults to false → no launch column);
// Permissions and task display names are stubbed so the composable can be
// exercised in isolation.
const mockUserCan = vi.fn(() => false);
vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({ userCan: mockUserCan }),
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

// Real task IDs are UUIDs; the slug is the human-readable part. Mirror the
// fixture style in useProgressExport.test.js (SWR/PA reuse the same UUIDs).
const SWR_TASK_UUID = '11111111-1111-4111-8111-111111111111';
const PA_TASK_UUID = '22222222-2222-4222-8222-222222222222';
const SRE_TASK_UUID = '33333333-3333-4333-8333-333333333333';
const MEP_TASK_UUID = '44444444-4444-4444-8444-444444444444';

// Intentionally out of display order so the composable's ordering is exercised.
const buildTasks = () =>
  ref([
    { taskId: MEP_TASK_UUID, taskSlug: 'mep', taskName: 'MEP', orderIndex: 3 },
    { taskId: PA_TASK_UUID, taskSlug: 'pa', taskName: 'PA', orderIndex: 2 },
    { taskId: SWR_TASK_UUID, taskSlug: 'swr', taskName: 'SWR', orderIndex: 0 },
    { taskId: SRE_TASK_UUID, taskSlug: 'sre', taskName: 'SRE', orderIndex: 1 },
  ]);

const tasksDictionary = ref({ swr: { nameSimple: 'Sight Words' } });
const administrationData = ref({ dates: { end: '2999-01-01T00:00:00.000Z' } });
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
  beforeEach(() => {
    mockUserCan.mockReturnValue(false);
  });

  it('returns an empty array while the task dictionary is loading', () => {
    const columns = buildColumns('school', { isUserSuperAdmin: false }, ref(true));
    expect(columns.value).toEqual([]);
  });

  it('orders priority tasks (swr, sre, pa) before the rest, using UUID field paths', () => {
    const columns = buildColumns('school', { isUserSuperAdmin: false });
    const taskCols = columns.value.filter((c) => c.dataType === 'progress').map((c) => c.field);
    expect(taskCols).toEqual([
      `progress.${SWR_TASK_UUID}.value`,
      `progress.${SRE_TASK_UUID}.value`,
      `progress.${PA_TASK_UUID}.value`,
      `progress.${MEP_TASK_UUID}.value`,
    ]);
  });

  it('uses the dictionary nameSimple for the header, falling back to the API task name', () => {
    const columns = buildColumns('school', { isUserSuperAdmin: false });
    const progressCols = columns.value.filter((c) => c.dataType === 'progress');
    expect(progressCols.find((c) => c.field === `progress.${SWR_TASK_UUID}.value`).header).toBe('Sight Words');
    expect(progressCols.find((c) => c.field === `progress.${MEP_TASK_UUID}.value`).header).toBe('MEP');
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

  describe('Launch Student column', () => {
    const launchColumns = (administration) =>
      useProgressColumns(
        ref(administration),
        buildStudents(),
        buildTasks(),
        tasksDictionary,
        districtSchools,
        { isUserSuperAdmin: false },
        'school',
        ref(false),
      ).progressReportColumns;

    it('is hidden when the user lacks launch permission, even for an open administration', () => {
      mockUserCan.mockReturnValue(false);
      const future = new Date(Date.now() + 86_400_000).toISOString();
      expect(launchColumns({ dates: { end: future } }).value.some((c) => c.launcher)).toBe(false);
    });

    it('shows for an open administration (end date in the future)', () => {
      mockUserCan.mockReturnValue(true);
      const future = new Date(Date.now() + 86_400_000).toISOString();
      expect(launchColumns({ dates: { end: future } }).value.some((c) => c.launcher)).toBe(true);
    });

    it('treats a future end date as open and a past end date as closed', () => {
      mockUserCan.mockReturnValue(true);
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const past = new Date(Date.now() - 86_400_000).toISOString();
      expect(launchColumns({ dates: { end: future } }).value.some((c) => c.launcher)).toBe(true);
      expect(launchColumns({ dates: { end: past } }).value.some((c) => c.launcher)).toBe(false);
    });
  });
});
