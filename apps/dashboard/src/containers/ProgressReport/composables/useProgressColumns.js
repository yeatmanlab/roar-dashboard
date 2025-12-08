import { computed } from 'vue';
import { usePermissions } from '@/composables/usePermissions';
import { Permissions } from '@bdelab/roar-firekit';
import { taskDisplayNames } from '@/helpers/reports.js';
import { PRIORITY_TASKS } from '../constants/progressReportConstants';

/**
 * Progress Report Columns Composable
 *
 * Dynamically builds table columns based on available data, permissions, and organization type.
 *
 * @param {import('vue').Ref} administrationData - Administration data
 * @param {import('vue').Ref} assignmentData - Assignment data
 * @param {import('vue').Ref} tasksDictionary - Dictionary of task information
 * @param {import('vue').Ref} districtSchoolsData - District schools data (if applicable)
 * @param {Object} authStore - Auth store instance
 * @param {String} orgType - Organization type (district, school, etc.)
 * @param {import('vue').Ref} isLoadingTasksDictionary - Loading state for tasks dictionary
 * @returns {Object} Computed columns
 */
export function useProgressColumns(
  administrationData,
  assignmentData,
  tasksDictionary,
  districtSchoolsData,
  authStore,
  orgType,
  isLoadingTasksDictionary,
) {
  const progressReportColumns = computed(() => {
    if (isLoadingTasksDictionary.value || assignmentData.value === undefined) return [];

    const tableColumns = [];

    // Add launch button if user has permission and administration is open
    const { userCan } = usePermissions();
    const isAdministrationOpen = administrationData.value?.dateClosed
      ? new Date(administrationData.value?.dateClosed) > new Date()
      : false;

    if (userCan(Permissions.Tasks.LAUNCH) && isAdministrationOpen) {
      tableColumns.push({
        header: 'Launch Student',
        launcher: true,
        routeName: 'LaunchHome',
        routeTooltip: 'Launch Student Assessment',
        routeIcon: 'pi pi-arrow-right border-none text-primary hover:text-white',
        sort: false,
        pinned: true,
      });
    }

    // Add user fields if they exist in the data
    if (assignmentData.value.find((assignment) => assignment.user?.username)) {
      tableColumns.push({
        field: 'user.username',
        header: 'Username',
        dataType: 'text',
        pinned: true,
        sort: true,
        filter: true,
      });
    }

    if (assignmentData.value.find((assignment) => assignment.user?.email)) {
      tableColumns.push({
        field: 'user.email',
        header: 'Email',
        dataType: 'text',
        pinned: true,
        sort: true,
        filter: true,
      });
    }

    if (assignmentData.value.find((assignment) => assignment.user?.name?.first)) {
      tableColumns.push({ field: 'user.firstName', header: 'First Name', dataType: 'text', sort: true, filter: true });
    }

    if (assignmentData.value.find((assignment) => assignment.user?.name?.last)) {
      tableColumns.push({ field: 'user.lastName', header: 'Last Name', dataType: 'text', sort: true, filter: true });
    }

    tableColumns.push({ field: 'user.grade', header: 'Grade', dataType: 'text', sort: true, filter: true });

    // Add school column for district reports
    if (orgType === 'district') {
      const schoolsMap = districtSchoolsData.value?.reduce((acc, school) => {
        acc[school.id] = school.name;
        return acc;
      }, {});

      tableColumns.push({
        field: 'user.schoolName',
        header: 'School',
        dataType: 'text',
        sort: true,
        filter: false,
        useMultiSelect: true,
        multiSelectOptions: districtSchoolsData.value.map((school) => school.name),
        multiSelectPlaceholder: 'Filter by School',
        schoolsMap: schoolsMap,
      });
    }

    // Add PID column for super admins
    if (authStore.isUserSuperAdmin) {
      tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
    }

    // Add task columns with priority ordering
    const allTaskIds = administrationData.value.assessments?.map((assessment) => assessment.taskId);
    const sortedTasks = allTaskIds?.sort((p1, p2) => {
      if (Object.keys(taskDisplayNames).includes(p1) && Object.keys(taskDisplayNames).includes(p2)) {
        return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
      } else {
        return -1;
      }
    });

    const orderedTasks = [];

    // Add priority tasks first
    for (const task of PRIORITY_TASKS) {
      if (sortedTasks.includes(task)) {
        orderedTasks.push(task);
      }
    }

    // Add remaining tasks
    for (const task of sortedTasks) {
      if (!PRIORITY_TASKS.includes(task)) {
        orderedTasks.push(task);
      }
    }

    // Create columns for each task
    for (const taskId of orderedTasks) {
      tableColumns.push({
        field: `progress.${taskId}.value`,
        filterField: `progress.${taskId}.tags`,
        header: tasksDictionary.value[taskId]?.publicName ?? taskId,
        dataType: 'progress',
        tag: true,
        severityField: `progress.${taskId}.severity`,
        iconField: `progress.${taskId}.icon`,
        sort: true,
      });
    }

    return tableColumns;
  });

  return {
    progressReportColumns,
  };
}
