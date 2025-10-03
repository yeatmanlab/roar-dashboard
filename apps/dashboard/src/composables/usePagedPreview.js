import { ref, nextTick } from 'vue';

/**
 * Paged preview composable built on top of pagedjs.
 *
 * The composable renders paginated pages for the entire document.
 *
 * The composable returns `run()` to generate the preview, `clear()` to remove generated pages and restore the source,
 * and state refs `isRendering` and `error`.
 */

let previewerCtorPromise = null;

/**
 * Lazily load pagedjs and return the Previewer constructor.
 * @returns {Promise<Function|null>}
 */
async function ensurePaged() {
  if (typeof window === 'undefined') return null;

  if (!previewerCtorPromise) {
    previewerCtorPromise = (async () => {
      const mod = await import('pagedjs'); // ESM build, no polyfill
      if (!mod?.Previewer) throw new Error('Paged.js ESM loaded but Previewer is missing');
      return mod.Previewer;
    })();
  }
  return previewerCtorPromise;
}

/**
 * Remove any previously generated pagedjs output and styles.
 *
 * @returns {void}
 */
function clearPagedOutputInternal() {
  document.querySelector('.pagedjs_pages')?.remove();
  document
    .querySelectorAll('style[data-pagedjs-internal], #pagedjs-generated-styles')
    .forEach((n) => n.parentElement?.removeChild(n));
}

/**
 * Wait for document fonts to be ready when supported.
 *
 * @returns {Promise<void>}
 */
async function waitForFonts() {
  if (document.fonts?.ready) {
     
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
}

/**
 * Wait for all valid images within the root (or entire document if null)
 * to finish loading (or error).
 *
 * @returns {Promise<void>}
 */
async function waitForImages() {
  const imgs = Array.from(document.querySelectorAll('img')).filter((img) => {
    const s = img.getAttribute('src') || '';
    return s && s !== 'undefined';
  });
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
          }),
    ),
  );
}

/**
 * Create a paged preview composable.
 *
 * @param {{ onRendered?: () => void, autoPrint?: boolean }} [opts]
 * @returns {Object} – The composable object.
 * @returns {Object.run} run – Generate the paged preview.
 * @returns {Object.clear} clear – Clear the generated preview and restore the source container.
 * @returns {Object.isRendering} isRendering – A ref indicating whether the preview is currently rendering.
 * @returns {Object.error} error – A ref containing any error that occurred during rendering.
 */
export default function usePagedPreview(opts = {}) {
  const isRendering = ref(false);
  const error = ref(null);
  let hasPosted = false;

  /**
   * Clear the generated preview and restore the source container.
   * @returns {void}
   */
  function clear() {
    clearPagedOutputInternal();
    hasPosted = false;
  }

  /**
   * Generate the paged preview.
   *
   * Performs a layout-friendly sequence: nextTick -> fonts -> rAF -> clear previous -> render via pagedjs.
   * Sets `isRendering` while running and stores any error into `error` ref.
   *
   * @returns {Promise<void>}
   */
  async function run() {
    error.value = null;

    try {
      await nextTick();

      await waitForFonts();
      await waitForImages();
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      clearPagedOutputInternal();

      if (isRendering.value) return;
      isRendering.value = true;

      const Previewer = await ensurePaged();
      if (!Previewer) throw new Error('Paged.js previewer not available.');

      const previewer = new Previewer();
      await previewer.preview();

      if (opts.onRendered) opts.onRendered();
      if (opts.autoPrint) window.print();

      if (!hasPosted && opts.postMessage && window.parent && window.parent !== window) {
        hasPosted = true;
        const cfg = typeof opts.postMessage === 'object' ? opts.postMessage : {};
        const payload = typeof cfg.build === 'function' ? cfg.build() : { type: 'page:loaded', timestamp: Date.now() };
        const origin = cfg.origin || window.location.origin;
        window.parent.postMessage(payload, origin);
      }
    } catch (e) {
      error.value = e;
       
      console.error('Paged.js preview failed:', e);
    } finally {
      isRendering.value = false;
    }
  }

  return { run, clear, isRendering, error };
}
