import { StatusCodes } from 'http-status-codes';
import { createApiClient } from '@roar-platform/assessment-sdk';

// 100 is the API's max perPage. Published variants per task are few, so a single page
// avoids pagination bookkeeping for a dev/staging convenience; if a task ever exceeds it,
// mountVariantPicker logs rather than silently truncating (see the totalPages check).
const VARIANTS_PER_PAGE = 100;

const PICKER_CONTAINER_ID = 'roar-variant-picker';

/**
 * Mounts a discreet variant-switcher dropdown for non-production (dev/staging) runs.
 *
 * Lists the published variants for `taskId` and lets a reviewer switch between them
 * without hand-editing the URL: selecting one reloads the page with the chosen
 * `variantId` (all other query params preserved), re-entering the standalone flow.
 *
 * This is a convenience for ephemeral/staging review only — callers gate on
 * `ROAR_DB !== 'production'`. Any failure is swallowed so the picker can never affect
 * the assessment itself. Relies on the caller having already provisioned the anonymous
 * ROAR user (via `bootstrapAnonymousSession`), which the auth-guarded list call requires.
 *
 * @param {object} options
 * @param {string} options.baseUrl - ROAR backend API base URL (ROAR_API_BASE_URL).
 * @param {{ getToken: () => Promise<string | undefined> }} options.auth - Anonymous auth callbacks.
 * @param {string | string[]} options.taskId - Task slug(s)/UUID(s) whose published variants to
 *   list. Pass an array for multi-task assessments (e.g. roam-apps, whose language-suffixed
 *   tasks each hold only a few variants) to aggregate published variants across all of them.
 * @param {string} [options.currentVariantId] - Variant to pre-select in the dropdown.
 * @returns {Promise<void>}
 */
export async function mountVariantPicker({ baseUrl, auth, taskId, currentVariantId }) {
  try {
    const client = createApiClient({ baseUrl, auth });
    // Accept one task or several. Multi-task assessments pass every task slug so the
    // dropdown surfaces all published variants across the app, not just one task's.
    const taskIds = Array.isArray(taskId) ? taskId : [taskId];

    const perTask = await Promise.all(
      taskIds.map(async (id) => {
        const result = await client.tasks.listTaskVariants({
          params: { taskId: id },
          // Sort/status are set explicitly (rather than leaning on the contract's defaults) so the
          // dropdown stays name-sorted and published-only regardless of future schema-default changes.
          query: {
            status: 'published',
            perPage: VARIANTS_PER_PAGE,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        });

        if (result.status !== StatusCodes.OK) {
          // A task slug that isn't seeded (e.g. an un-seeded locale) returns non-200 —
          // skip it rather than aborting the whole picker.
          console.warn(`[variant-picker] listTaskVariants(${id}) returned ${result.status}`);
          return [];
        }

        const { items, pagination } = result.body.data;
        // The single page is capped at the API max (VARIANTS_PER_PAGE); make truncation
        // visible rather than silently showing only the first page.
        if (pagination && pagination.totalPages > 1) {
          console.warn(
            `[variant-picker] ${id} has more than ${VARIANTS_PER_PAGE} published variants; ` +
              `showing only the first page (${pagination.totalPages} pages total).`,
          );
        }
        return items;
      }),
    );

    // Aggregate and re-sort by name — per-task sorting doesn't guarantee global order.
    const variants = perTask.flat().sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    if (variants.length === 0) return;

    renderPicker(variants, currentVariantId);
  } catch (err) {
    // Never let a dev/staging convenience break the assessment.
    console.warn('[variant-picker] failed to mount', err);
  }
}

/**
 * Renders (or re-renders) the fixed-position picker with the given variants.
 *
 * @param {Array<{ id: string, name: string | null }>} variants - Published variants, sorted by name.
 * @param {string | undefined} currentVariantId - Active variant to pre-select.
 * @returns {void}
 */
function renderPicker(variants, currentVariantId) {
  document.getElementById(PICKER_CONTAINER_ID)?.remove();

  const options = [...variants];
  // If the active variant isn't in the published set (e.g. a draft targeted directly by
  // URL), surface it so the dropdown always reflects what is actually running.
  if (currentVariantId && !options.some((variant) => variant.id === currentVariantId)) {
    options.unshift({ id: currentVariantId, name: '(current)' });
  }

  const container = document.createElement('div');
  container.id = PICKER_CONTAINER_ID;
  Object.assign(container.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    borderRadius: '6px',
    background: 'rgba(17, 24, 39, 0.85)',
    color: '#fff',
    font: '12px/1.4 system-ui, -apple-system, sans-serif',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
  });

  const label = document.createElement('span');
  label.textContent = 'Variant';
  label.style.opacity = '0.8';

  const select = document.createElement('select');
  select.id = `${PICKER_CONTAINER_ID}-select`;
  Object.assign(select.style, {
    font: 'inherit',
    color: '#111',
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    padding: '2px 4px',
    maxWidth: '240px',
  });

  for (const variant of options) {
    const option = document.createElement('option');
    option.value = variant.id;
    // Fall back to a short id prefix when unnamed. The full uuid isn't needed in the label —
    // selecting a variant writes it to the URL (?variantId=), so this can stay compact.
    option.textContent = variant.name || `variant ${variant.id.slice(0, 8)}`;
    option.selected = variant.id === currentVariantId;
    select.appendChild(option);
  }

  // Selecting a variant reloads with the new variantId while preserving other params
  // (e.g. ?task= for multi-task assessments), re-entering the standalone flow.
  select.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('variantId', select.value);
    window.location.assign(url.toString());
  });

  container.append(label, select);
  // Mount on <html>, not <body>: jsPsych resets `document.body.innerHTML` when the
  // experiment starts, which would wipe a body-mounted picker (it flashes in, then
  // vanishes). The picker is position:fixed, so its parent doesn't affect placement,
  // and its max z-index keeps it above the progress bar.
  document.documentElement.appendChild(container);
}
