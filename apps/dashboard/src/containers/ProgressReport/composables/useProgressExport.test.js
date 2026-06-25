import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useProgressExport } from './useProgressExport';

// Mock the exportCsv helper
vi.mock('@/helpers/query/utils', () => ({
  exportCsv: vi.fn(),
}));

import { exportCsv } from '@/helpers/query/utils';

// Progress and tasks are keyed by task UUID in production; use UUID-shaped ids
// here so the fixtures mirror the real data shape.
const SWR_TASK_UUID = '11111111-1111-4111-8111-111111111111';
const PA_TASK_UUID = '22222222-2222-4222-8222-222222222222';

describe('useProgressExport', () => {
  let mockProgressData;
  let mockTasks;
  let mockTasksDictionary;
  let mockAdministrationData;
  let mockOrgData;
  let mockDisplayName;
  let mockAuthStore;

  beforeEach(() => {
    vi.clearAllMocks();

    // Progress is keyed by task UUID; headers are resolved from the tasks metadata.
    mockProgressData = computed(() => [
      {
        user: {
          username: 'student1',
          email: 'student1@test.com',
          firstName: 'John',
          lastName: 'Doe',
          grade: '3',
          assessmentPid: 'PID123',
          schoolName: 'Test School',
        },
        progress: {
          [SWR_TASK_UUID]: { value: 'completed' },
          [PA_TASK_UUID]: { value: 'started' },
        },
      },
      {
        user: {
          username: 'student2',
          email: 'student2@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          grade: '4',
          assessmentPid: 'PID456',
          schoolName: 'Test School',
        },
        progress: {
          [SWR_TASK_UUID]: { value: 'assigned' },
          [PA_TASK_UUID]: { value: 'completed' },
        },
      },
    ]);

    mockTasks = ref([
      { taskId: SWR_TASK_UUID, taskSlug: 'swr', taskName: 'SWR' },
      { taskId: PA_TASK_UUID, taskSlug: 'pa', taskName: 'PA' },
    ]);

    mockTasksDictionary = ref({
      swr: { nameSimple: 'Sight Word Reading' },
      pa: { nameSimple: 'Phonological Awareness' },
    });

    mockAdministrationData = ref({ name: 'Test Administration' });
    mockOrgData = ref({ name: 'Test Organization' });
    mockDisplayName = computed(() => 'Test Administration Display');
    mockAuthStore = { isUserSuperAdmin: false };
  });

  const build = (orgType) =>
    useProgressExport(
      mockProgressData,
      mockTasks,
      mockTasksDictionary,
      mockAdministrationData,
      mockOrgData,
      mockDisplayName,
      mockAuthStore,
      orgType,
    );

  describe('exportSelected', () => {
    it('exports selected rows with friendly task headers', () => {
      const { exportSelected } = build('school');

      exportSelected([mockProgressData.value[0]]);

      expect(exportCsv).toHaveBeenCalledTimes(1);
      expect(exportCsv).toHaveBeenCalledWith(
        [
          {
            Username: 'student1',
            Email: 'student1@test.com',
            First: 'John',
            Last: 'Doe',
            Grade: '3',
            'Sight Word Reading': 'completed',
            'Phonological Awareness': 'started',
          },
        ],
        'roar-progress-selected.csv',
      );
    });

    it('includes PID for super admins', () => {
      mockAuthStore.isUserSuperAdmin = true;
      const { exportSelected } = build('school');

      exportSelected([mockProgressData.value[0]]);

      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ PID: 'PID123' })]),
        'roar-progress-selected.csv',
      );
    });

    it('includes the School column for district reports', () => {
      const { exportSelected } = build('district');

      exportSelected([mockProgressData.value[0]]);

      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ School: 'Test School' })]),
        'roar-progress-selected.csv',
      );
    });

    it('falls back to the API task name when the dictionary entry is missing', () => {
      mockTasksDictionary.value = {};
      const { exportSelected } = build('school');

      exportSelected([mockProgressData.value[0]]);

      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ SWR: 'completed', PA: 'started' })]),
        'roar-progress-selected.csv',
      );
    });
  });

  describe('exportAll', () => {
    it('exports all rows', () => {
      const { exportAll } = build('school');

      exportAll();

      expect(exportCsv).toHaveBeenCalledTimes(1);
      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ Username: 'student1' }),
          expect.objectContaining({ Username: 'student2' }),
        ]),
        'roar-progress-test-administration-display-test-organization.csv',
      );
    });

    it('generates a kebab-case filename', () => {
      mockDisplayName = computed(() => 'Test Administration 2024');
      mockOrgData.value.name = 'Test Organization Name';
      const { exportAll } = build('school');

      exportAll();

      expect(exportCsv).toHaveBeenCalledWith(
        expect.any(Array),
        'roar-progress-test-administration-2024-test-organization-name.csv',
      );
    });

    it('includes all fields for a super admin district report', () => {
      mockAuthStore.isUserSuperAdmin = true;
      const { exportAll } = build('district');

      exportAll();

      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            Username: 'student1',
            Email: 'student1@test.com',
            First: 'John',
            Last: 'Doe',
            Grade: '3',
            PID: 'PID123',
            School: 'Test School',
            'Sight Word Reading': 'completed',
            'Phonological Awareness': 'started',
          }),
        ]),
        expect.any(String),
      );
    });
  });
});
