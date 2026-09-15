import { ref } from 'vue';
import * as Sentry from '@sentry/vue';
import _kebabCase from 'lodash/kebabCase';
import { StatusCodes } from 'http-status-codes';
import {
  CSV_EXPORT_WARNING_THRESHOLD,
  CSV_EXPORT_STRONG_WARNING_THRESHOLD,
  CSV_EXPORT_CRITICAL_THRESHOLD,
  CSV_EXPORT_BATCH_SIZE,
} from '@/constants/csvExport';
import { getRoarApiClient } from '@/clients/roar-api';
import { orgUsersResolvers } from '@/helpers/orgUsersResolvers';
import { mapEnrolledUserForExport } from '@/helpers/mappers/mapEnrolledUserForExport';
import { exportCsv } from '@/helpers/query/utils';
import { WARNING_LEVELS } from '../constants/exportConstants';

// The org enrolled-user list endpoints cap `perPage` at 100. Page at the max so
// a full export reads the fewest possible round-trips (bulk reads, not N+1).
const EXPORT_FETCH_PER_PAGE = 100;

// A single tiny request used only to read `pagination.totalItems` for the
// warning-threshold decision before committing to a full export.
const COUNT_PROBE_PER_PAGE = 1;

/**
 * Pure export logic composable - handles data fetching and CSV generation
 *
 * Sources rows from the typed `listUsers` backend endpoints (the same per-org
 * endpoints the list view uses), requesting `?embed=demographics` so the export
 * gets the student PII columns (`userType`, ELL/IEP/FRL status, race, ethnicity,
 * home language) that the lean list row omits. The full export is assembled by
 * paging through every page in bulk; there is no per-user fetch.
 *
 * The typed endpoint paginates and sorts server-side, so the export no longer
 * needs the legacy Firestore `orderBy` structure — row order does not affect the
 * exported column set, and the endpoint applies a stable default sort.
 *
 * @param {Ref<string>} activeOrgType - The active (plural) organization type.
 * @returns {object} Export functions and utilities
 */
export function useOrgExport(activeOrgType) {
  // Progress tracking
  const currentBatch = ref(0);
  const totalBatches = ref(0);
  const cancelRequested = ref(false);

  /**
   * Resolves the typed `listUsers` action and path-param name for the active
   * org type, throwing if the org type has no per-org user-list endpoint
   * (e.g. `families`). Centralising dispatch here mirrors the table query and
   * guarantees the export can never query a different org type than intended.
   *
   * @param {string} orgType - The plural org type to resolve.
   * @returns {{ action: Function, paramKey: string }} The resolver entry.
   */
  const resolveOrgUsersEndpoint = (orgType) => {
    const resolver = orgUsersResolvers(getRoarApiClient())[orgType];

    if (!resolver) {
      // Not a user-facing path under normal use: the export button is wired to
      // org types that have a list endpoint. An unknown type here (notably
      // `families`) is a programming/wiring error.
      throw new Error(`useOrgExport: unsupported org type "${orgType}"`);
    }

    return resolver;
  };

  /**
   * Fetches a single page of enrolled users (with the demographics embed) from
   * the typed endpoint and returns the unwrapped payload.
   *
   * @param {{ action: Function, paramKey: string }} resolver - Endpoint resolver.
   * @param {string} orgId - The org's UUID.
   * @param {number} page - 1-indexed page to fetch.
   * @returns {Promise<{ items: object[], pagination: object }>} The page payload.
   */
  const fetchUsersPage = async (resolver, orgId, page) => {
    const result = await resolver.action({
      params: { [resolver.paramKey]: orgId },
      query: {
        page,
        perPage: EXPORT_FETCH_PER_PAGE,
        // Wire format is a comma-separated string; this is the single embed option.
        embed: 'demographics',
      },
    });

    if (result.status !== StatusCodes.OK) {
      // Surface non-200 ts-rest results as thrown errors so the orchestrator's
      // try/catch routes them to the failure modal. The thrown shape carries the
      // ts-rest response for any downstream introspection.
      const error = new Error(`Failed to fetch org users for export with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    }

    return result.body.data;
  };

  /**
   * Pages through every accessible user for the org, accumulating the raw API
   * rows. Bulk reads only — one request per page (max 100 rows), looping until
   * the last page reported by `pagination.totalPages`. Cancellation is checked
   * after each page so a cancel request stops the fetch promptly.
   *
   * @param {string} orgId - The org's UUID.
   * @returns {Promise<{ rows: object[], cancelled: boolean }>} Accumulated rows,
   *   plus whether the loop stopped early due to cancellation.
   */
  const fetchAllOrgUsers = async (orgId) => {
    const resolver = resolveOrgUsersEndpoint(activeOrgType.value);
    const rows = [];
    let page = 1;
    let totalPages = 1;

    do {
      if (cancelRequested.value) {
        return { rows, cancelled: true };
      }

      const data = await fetchUsersPage(resolver, orgId, page);
      rows.push(...data.items);
      totalPages = data.pagination.totalPages;
      page += 1;
    } while (page <= totalPages);

    return { rows, cancelled: false };
  };

  /**
   * Check if an object has a name property.
   */
  const hasNameProperty = (obj) => {
    return obj && typeof obj === 'object' && 'name' in obj;
  };

  /**
   * Determines the warning level based on user count.
   */
  const getExportWarningLevel = (userCount) => {
    if (userCount >= CSV_EXPORT_CRITICAL_THRESHOLD) return WARNING_LEVELS.CRITICAL;
    if (userCount >= CSV_EXPORT_STRONG_WARNING_THRESHOLD) return WARNING_LEVELS.STRONG;
    if (userCount >= CSV_EXPORT_WARNING_THRESHOLD) return WARNING_LEVELS.NORMAL;
    return WARNING_LEVELS.NONE;
  };

  /**
   * Transforms raw API enrolled-user rows into the export column shape.
   * Each row is mapped through {@link mapEnrolledUserForExport}, which pins the
   * CSV header set, order, and per-cell formatting to the pre-migration output.
   */
  const transformUsersForExport = (users) => {
    return users.map(mapEnrolledUserForExport);
  };

  /**
   * Counts users for an organization via the typed endpoint.
   *
   * Reads `pagination.totalItems` from a single one-row probe request rather
   * than fetching any user data — the total drives the warning-threshold and
   * zero-user decisions before a full export is committed.
   *
   * @param {object} orgType - Organization to count (`{ id, name }`).
   * @returns {Promise<number>} Total accessible user count for the org.
   */
  const countOrgUsers = async (orgType) => {
    try {
      const resolver = resolveOrgUsersEndpoint(activeOrgType.value);
      const result = await resolver.action({
        params: { [resolver.paramKey]: orgType.id },
        query: { page: 1, perPage: COUNT_PROBE_PER_PAGE },
      });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to count org users for export with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data.pagination.totalItems;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

  /**
   * Performs a batched export for large datasets.
   * Fetches all rows once (paged, in bulk) and splits the serialisation into
   * multiple CSV files of `CSV_EXPORT_BATCH_SIZE` rows each to avoid building one
   * oversized file. The multi-file output is byte-compatible with the previous
   * Firestore-sourced export.
   *
   * @param {Function} onProgress - Optional callback for progress updates.
   * @returns {object} Result object with success status and batch info.
   */
  const performBatchedExport = async (orgType, onProgress) => {
    const { rows, cancelled } = await fetchAllOrgUsers(orgType.id);

    if (cancelled || cancelRequested.value) {
      return { cancelled: true, batchesCompleted: 0 };
    }

    const exportData = transformUsersForExport(rows);
    const numBatches = Math.max(1, Math.ceil(exportData.length / CSV_EXPORT_BATCH_SIZE));
    totalBatches.value = numBatches;

    for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
      if (cancelRequested.value) {
        return { cancelled: true, batchesCompleted: batchIndex };
      }

      currentBatch.value = batchIndex + 1;

      if (onProgress) {
        onProgress(currentBatch.value, totalBatches.value);
      }

      const start = batchIndex * CSV_EXPORT_BATCH_SIZE;
      const batchData = exportData.slice(start, start + CSV_EXPORT_BATCH_SIZE);
      const filename = `${_kebabCase(orgType.name)}-users-export-part-${batchIndex + 1}-of-${numBatches}.csv`;
      exportCsv(batchData, filename);

      // Small delay between files to avoid overwhelming the browser with downloads.
      if (batchIndex < numBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return { success: true, batched: true, batchCount: numBatches };
  };

  /**
   * Performs a single export for smaller datasets.
   * Fetches all rows once (paged, in bulk) and writes a single CSV file.
   * @returns {object} Result object with success status.
   */
  const performSingleExport = async (orgType) => {
    const { rows, cancelled } = await fetchAllOrgUsers(orgType.id);

    if (cancelled || cancelRequested.value) {
      return { cancelled: true };
    }

    const exportData = transformUsersForExport(rows);
    exportCsv(exportData, `${_kebabCase(orgType.name)}-users-export.csv`);

    return { success: true, batched: false, batchCount: 1 };
  };

  /**
   * Performs the actual CSV export.
   * Automatically chooses between single or batched export based on user count.
   * @param {object} orgType - Organization to export.
   * @param {number} userCount - Number of users to export.
   * @param {Function} onProgress - Optional callback for progress updates.
   * @returns {object} Result object with success status and batch info.
   */
  const performExport = async (orgType, userCount, onProgress) => {
    try {
      const needsBatching = userCount >= CSV_EXPORT_CRITICAL_THRESHOLD;

      if (needsBatching) {
        return await performBatchedExport(orgType, onProgress);
      } else {
        return await performSingleExport(orgType);
      }
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

  /**
   * Requests cancellation of ongoing export.
   */
  const requestCancel = () => {
    cancelRequested.value = true;
  };

  /**
   * Resets export state.
   */
  const resetExportState = () => {
    cancelRequested.value = false;
    currentBatch.value = 0;
    totalBatches.value = 0;
  };

  return {
    // State
    currentBatch,
    totalBatches,

    // Functions
    hasNameProperty,
    getExportWarningLevel,
    countOrgUsers,
    performExport,
    requestCancel,
    resetExportState,
  };
}
