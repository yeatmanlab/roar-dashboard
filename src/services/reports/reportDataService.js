/**
 * Report Data Service
 * Handles data formatting and processing for student reports
 */
import { taskDisplayNames } from '@/helpers/reports';

/**
 * Formats a list of tasks into a readable string
 * @param {Array} tasks - Array of task IDs
 * @param {Object} tasksDictionary - Dictionary of task information
 * @returns {String} Formatted task list
 */
export const formatTaskList = (tasks = [], tasksDictionary = {}) => {
  if (!tasks || tasks.length === 0) return '';

  console.log({
    tasks,
    tasksDictionary,
    taskDisplayNames,
  });

  return (
    tasks
      .sort((a, b) => {
        if (Object.keys(taskDisplayNames).includes(a) && Object.keys(taskDisplayNames).includes(b)) {
          return taskDisplayNames[a].order - taskDisplayNames[b].order;
        } else {
          return -1;
        }
      })
      .map((task) => tasksDictionary[task]?.technicalName ?? task)
      .join(', ') + '.'
  );
};
