import { computed } from 'vue';
import { usePermissions } from '@/composables/usePermissions';
import { Permissions } from '@bdelab/roar-firekit';
import { taskDisplayNames } from '@/helpers/reports.js';
import { PRIORITY_TASKS } from '../constants/progressReportConstants';

/**
 * Orders report task metadata: priority tasks first (in PRIORITY_TASKS order),
 * then the remainder by their display order (falling back to the API orderIndex).
 *
 * @param {Array} tasks – `{ taskId, taskSlug, taskName, orderIndex }[]` from the API.
 * @returns {Array} the tasks in display order.
 */
function orderTasks(tasks) {
  const priority = [];
  const remaining = [];

  for (const task of tasks) {
    if (PRIORITY_TASKS.includes(task.taskSlug)) {
      priority.push(task);
    } else {
      remaining.push(task);
    }
  }

  priority.sort((a, b) => PRIORITY_TASKS.indexOf(a.taskSlug) - PRIORITY_TASKS.indexOf(b.taskSlug));
  remaining.sort((a, b) => {
    const orderA = taskDisplayNames[a.taskSlug]?.order;
    const orderB = taskDisplayNames[b.taskSlug]?.order;
    if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
    if (orderA !== undefined) return -1;
    if (orderB !== undefined) return 1;
    return a.orderIndex - b.orderIndex;
  });

  return [...priority, ...remaining];
}

/**
 * Progress Report Columns Composable
 *
 * Dynamically builds table columns based on available data, permissions, and
 * organization type. Task columns are driven by the self-describing `tasks`
 * metadata from the progress API (UUID-keyed progress map), so no separate task
 * dictionary is required to know which columns exist — the dictionary is used
 * only for friendly column headers.
 *
 * @param {import('vue').Ref} administrationData - Administration data (for the launch/open check).
 * @param {import('vue').Ref} students - Student progress rows (for user-field presence checks).
 * @param {import('vue').Ref} tasks - Report task metadata array from the progress API.
 * @param {import('vue').Ref} tasksDictionary - Dictionary of task display names (keyed by task slug).
 * @param {import('vue').Ref} districtSchoolsData - District schools data (district scope only).
 * @param {Object} authStore - Auth store instance.
 * @param {String} orgType - Organization type (district, school, etc.).
 * @param {import('vue').Ref} isLoadingTasksDictionary - Loading state for tasks dictionary.
 * @returns {Object} Computed columns.
 */
export function useProgressColumns(
  administrationData,
  students,
  tasks,
  tasksDictionary,
  districtSchoolsData,
  authStore,
  orgType,
  isLoadingTasksDictionary,
) {
  const progressReportColumns = computed(() => {
    if (isLoadingTasksDictionary.value || students.value === undefined) return [];

    const tableColumns = [];

    // Add launch button if user has permission and administration is open
    const { userCan } = usePermissions();
    // Open when the administration's end date is still in the future. `dates.end` is
    // notNull on the API administration (from `useAdministrationQuery`), so there is no
    // open-indefinitely case. Guarded on a loaded administration so the Launch button
    // doesn't flash before the administration query resolves.
    const admin = administrationData.value;
    const isAdministrationOpen = Boolean(admin?.dates?.end) && new Date(admin.dates.end) > new Date();

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
    if (students.value.find((student) => student.user?.username)) {
      tableColumns.push({
        field: 'user.username',
        header: 'Username',
        dataType: 'text',
        pinned: true,
        sort: true,
        filter: true,
      });
    }

    if (students.value.find((student) => student.user?.email)) {
      tableColumns.push({
        field: 'user.email',
        header: 'Email',
        dataType: 'text',
        pinned: true,
        sort: true,
        filter: true,
      });
    }

    if (students.value.find((student) => student.user?.firstName)) {
      tableColumns.push({ field: 'user.firstName', header: 'First Name', dataType: 'text', sort: true, filter: true });
    }

    if (students.value.find((student) => student.user?.lastName)) {
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
        multiSelectOptions: (districtSchoolsData.value ?? []).map((school) => school.name),
        multiSelectPlaceholder: 'Filter by School',
        schoolsMap: schoolsMap,
      });
    }

    // Add PID column for super admins
    if (authStore.isUserSuperAdmin) {
      tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
    }

    // Create columns for each task (progress map is keyed by task UUID)
    for (const task of orderTasks(tasks.value ?? [])) {
      tableColumns.push({
        field: `progress.${task.taskId}.value`,
        filterField: `progress.${task.taskId}.tags`,
        header: tasksDictionary.value?.[task.taskSlug]?.nameSimple ?? task.taskName,
        dataType: 'progress',
        tag: true,
        severityField: `progress.${task.taskId}.severity`,
        iconField: `progress.${task.taskId}.icon`,
        sort: true,
      });
    }

    return tableColumns;
  });

  return {
    progressReportColumns,
  };
}
