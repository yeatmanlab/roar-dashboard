export const READALOUD_TASK_ID = 'roar-readaloud' as const;
export type ReadaloudTaskId = typeof READALOUD_TASK_ID;

/**
 * GCS URL for a read-aloud test-config corpus (the phonics word lists / stimuli a
 * variant points at via its `testConfigFile` param). English only.
 *
 * @param testConfigFile - The test config file name (e.g. 'read-aloud-2025-08-01-A')
 * @returns The full GCS URL for the test config JSON
 */
export const READALOUD_TEST_CONFIG_URL = (testConfigFile: string): string =>
  `https://storage.googleapis.com/roav-readaloud/en/shared/${testConfigFile}.json`;

/**
 * Azure blob URL for a device-configuration profile used during device setup (the
 * profile a variant points at via its `deviceConfigFile` param).
 *
 * @param deviceConfigFile - The device config file name (e.g. 'devices_default')
 * @returns The full Azure blob URL for the device config JSON
 */
export const READALOUD_DEVICE_CONFIG_URL = (deviceConfigFile: string): string =>
  `https://eyetrackingdata.blob.core.windows.net/public/config/${deviceConfigFile}.json`;
