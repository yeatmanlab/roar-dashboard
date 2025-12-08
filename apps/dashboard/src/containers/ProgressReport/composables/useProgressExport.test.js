import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useProgressExport } from './useProgressExport';

// Mock the exportCsv helper
vi.mock('@/helpers/query/utils', () => ({
  exportCsv: vi.fn(),
}));

import { exportCsv } from '@/helpers/query/utils';

describe('useProgressExport', () => {
  let mockProgressData;
  let mockTasksDictionary;
  let mockAdministrationData;
  let mockOrgData;
  let mockDisplayName;
  let mockAuthStore;

  beforeEach(() => {
    vi.clearAllMocks();

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
          swr: { value: 'completed' },
          pa: { value: 'started' },
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
          swr: { value: 'assigned' },
          pa: { value: 'completed' },
        },
      },
    ]);

    mockTasksDictionary = ref({
      swr: { publicName: 'Sight Word Reading' },
      pa: { publicName: 'Phonological Awareness' },
    });

    mockAdministrationData = ref({
      name: 'Test Administration',
    });

    mockOrgData = ref({
      name: 'Test Organization',
    });

    mockDisplayName = computed(() => 'Test Administration Display');

    mockAuthStore = {
      isUserSuperAdmin: false,
    };
  });

  describe('exportSelected', () => {
    it('should export selected rows with basic fields', () => {
      const { exportSelected } = useProgressExport(
        mockProgressData,
        mockTasksDictionary,
        mockAdministrationData,
        mockOrgData,
        mockDisplayName,
        mockAuthStore,
        'school',
      );

      const selectedRows = [mockProgressData.value[0]];
      exportSelected(selectedRows);

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

    it('should include PID for super admins', () => {
      mockAuthStore.isUserSuperAdmin = true;

      const { exportSelected } = useProgressExport(
        mockProgressData,
        mockTasksDictionary,
        mockAdministrationData,
        mockOrgData,
        mockDisplayName,
        mockAuthStore,
        'school',
      );

      const selectedRows = [mockProgressData.value[0]];
      exportSelected(selectedRows);

      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            PID: 'PID123',
          }),
        ]),
        'roar-progress-selected.csv',
      );
    });

    it('should include School column for district reports', () => {
      const { exportSelected } = useProgressExport(
        mockProgressData,
        mockTasksDictionary,
        mockAdministrationData,
        mockOrgData,
        mockDisplayName,
        mockAuthStore,
        'district',
      );

      const selectedRows = [mockProgressData.value[0]];
      exportSelected(selectedRows);

      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            School: 'Test School',
          }),
        ]),
        'roar-progress-selected.csv',
      );
    });

    it('should use task ID when public name is not available', () => {
      mockTasksDictionary.value = {
        swr: {},
        pa: {},
      };

      const { exportSelected } = useProgressExport(
        mockProgressData,
        mockTasksDictionary,
        mockAdministrationData,
        mockOrgData,
        mockDisplayName,
        mockAuthStore,
        'school',
      );

      const selectedRows = [mockProgressData.value[0]];
      exportSelected(selectedRows);

      expect(exportCsv).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            swr: 'completed',
            pa: 'started',
          }),
        ]),
        'roar-progress-selected.csv',
      );
    });
  });

  describe('exportAll', () => {
    it('should export all rows', () => {
      const { exportAll } = useProgressExport(
        mockProgressData,
        mockTasksDictionary,
        mockAdministrationData,
        mockOrgData,
        mockDisplayName,
        mockAuthStore,
        'school',
      );

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

    it('should generate kebab-case filename', () => {
      mockDisplayName = computed(() => 'Test Administration 2024');
      mockOrgData.value.name = 'Test Organization Name';

      const { exportAll } = useProgressExport(
        mockProgressData,
        mockTasksDictionary,
        mockAdministrationData,
        mockOrgData,
        mockDisplayName,
        mockAuthStore,
        'school',
      );

      exportAll();

      expect(exportCsv).toHaveBeenCalledWith(
        expect.any(Array),
        'roar-progress-test-administration-2024-test-organization-name.csv',
      );
    });

    it('should include all fields for super admin district report', () => {
      mockAuthStore.isUserSuperAdmin = true;

      const { exportAll } = useProgressExport(
        mockProgressData,
        mockTasksDictionary,
        mockAdministrationData,
        mockOrgData,
        mockDisplayName,
        mockAuthStore,
        'district',
      );

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
