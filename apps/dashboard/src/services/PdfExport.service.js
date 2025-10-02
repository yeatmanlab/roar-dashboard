import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// US Letter size in mm (215.9 x 279.4 mm)
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;

const EXPORT_CONTAINER_SELECTOR = '[data-pdf-export-container]';
const DEFAULT_BULK_EXPORT_FILENAME = 'documents.zip';

const H2C_WINDOW_WIDTH = 1440; // ensure export layout uses xl breakpoint (3 cols)
const DEFAULT_WAIT_PAGED_MS = 5000; // fallback wait for pages after page:loaded
const DEFAULT_IFRAME_TIMEOUT_MS = 30000; // timeout for loading iframe content

/**
 * PDF export utilities for rendering DOM content into paginated PDF documents.
 *
 * This module captures Paged.js-rendered pages with html2canvas and composes a PDF with jsPDF.
 *
 * Flow overview:
 * - Child page renders within an iFrame and posts `page:loaded` after Paged.js preview completes
 * - Service waits for `page:loaded` and captures the rendered pages using html2canvas
 * - Service composes a PDF with jsPDF and returns it as a Blob that can be downloaded or zipped
 */
const PdfExportService = (() => {
  /**
   * Get Paged.js-rendered pages from a document.
   *
   * @param {Document} doc - The target document (e.g., iframe.contentDocument)
   * @returns {HTMLElement[]} Array of page elements or empty array
   */
  const getPages = (doc) => {
    if (!doc) return [];
    const pages = Array.from(doc.querySelectorAll('.pagedjs_pages .pagedjs_page'));
    return pages;
  };

  /**
   * Wait for Paged.js pages to be present.
   * Note: createVirtualContent() already waits for the child to postMessage `page:loaded`,
   * which indicates preview pagination is complete. This function is a light safety net
   * to ensure pages exist before capture.
   *
   * @param {Document} doc - The target document
   * @param {number} timeoutMs - Max wait in ms
   * @returns {Promise<HTMLElement[]>} Resolves with the pages array (possibly empty on timeout)
   */
  const waitForPages = async (doc, timeoutMs = DEFAULT_WAIT_PAGED_MS) => {
    if (!doc) return [];
    let pages = getPages(doc);
    if (pages.length > 0) return pages;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
      pages = getPages(doc);
      if (pages.length > 0) return pages;
    }
    return pages;
  };

  /**
   * Render a set of Paged.js pages into a jsPDF.
   *
   * @param {HTMLElement[]} pages - Elements with class `.pagedjs_page`
   * @param {Object} options
   * @param {('portrait'|'landscape')} [options.orientation='portrait'] - jsPDF page orientation
   * @param {('letter'|'a4'|string)} [options.format='letter'] - jsPDF paper format
   * @param {boolean} [options.returnBlob=false] - When true, returns Blob instead of saving
   * @param {string} [options.fileName='document.pdf'] - Filename to save when not returning Blob
   * @returns {Promise<Blob|void>} PDF Blob when `returnBlob=true`, otherwise void after save
   */
  const renderPagesToPdf = async (pages, options = {}) => {
    const orientation = options.orientation || 'portrait';
    const format = options.format || 'letter';
    const returnBlob = options.returnBlob || false;
    const fileName = options.fileName || 'document.pdf';

    const pdf = new jsPDF({ orientation, unit: 'mm', format, compress: true, precision: 16, hotfixes: ['px_scaling'] });

    // Helper to add a single page element as a full PDF page
    const addPagedElement = async (el, isFirstPage) => {
      // Use a consistent html2canvas configuration for fidelity
      const canvas = await renderElementToCanvas(el);
      const imgData = canvas.toDataURL('image/png', 1.0);

      // Compute target dimensions while preserving aspect ratio to fit the full page
      const pageW = PAGE_WIDTH;
      const pageH = PAGE_HEIGHT;

      if (!isFirstPage) pdf.addPage([pageW, pageH], 'mm');
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
    };

    let first = true;
    for (const page of pages) {
      await addPagedElement(page, first);
      first = false;
    }

    if (returnBlob) return pdf.output('blob');
    pdf.save(fileName);
  };

  /**
   * Render an element to a canvas using html2canvas with consistent options.
   *
   * @param {HTMLElement} element - The element to rasterize
   * @returns {Promise<HTMLCanvasElement>} A promise that resolves to the rendered canvas
   */
  const renderElementToCanvas = async (element) => {
    const options = {
      logging: false,
      scale: 3,
      windowWidth: H2C_WINDOW_WIDTH,
      letterRendering: true,
      useCORS: true,
      imageTimeout: 2000,
      backgroundColor: '#ffffff',
    };
    return html2canvas(element, options);
  };

  /**
   * Generate a PDF document from Paged.js-rendered pages in the current (or owner) document.
   *
   * @param {HTMLElement[]} elements - DOM elements used only to resolve `ownerDocument`; ignored for content
   * @param {string} fileName - File name for the exported PDF; when falsy and not returning a blob, defaults to 'document.pdf'
   * @param {Object} [options] - Additional configuration
   * @param {('portrait'|'landscape')} [options.orientation='portrait'] - Page orientation
   * @param {('letter'|'a4'|string)} [options.format='letter'] - Paper format
   * @param {boolean} [options.returnBlob=false] - If true, return a Blob instead of triggering download
   * @returns {Promise<void|Blob>} Resolves after saving the file or returns a Blob when `returnBlob=true`
   */
  const generateDocument = async (elements, fileName, options = {}) => {
    const targetDoc = (elements && elements.length > 0 && elements[0]?.ownerDocument) || document;

    const orientation = options.orientation || 'portrait';
    const format = options.format || 'letter';
    const returnBlob = options.returnBlob || false;

    // Wait for Paged.js pages
    const pages = await waitForPages(targetDoc, 20000);

    if (!pages || pages.length === 0) {
      throw new Error('No pages found. Ensure the view is rendered with Paged.js before exporting.');
    }

    // Render each paged page into the PDF
    return renderPagesToPdf(pages, {
      orientation,
      format,
      returnBlob,
      fileName,
    });
  };

  /**
   * Create a virtual iframe to load content for PDF generation.
   *
   * The loaded page is expected to postMessage `{ type: 'page:loaded' }` once Paged.js
   * preview completes (hooked in `StudentScoreReport.vue`).
   *
   * @param {string} url - URL to load in the iframe
   * @param {Object} [options]
   * @param {string} [options.containerSelector='[data-pdf-export-container]'] - Selector for the container to capture
   * @param {number} [options.timeout=30000] - Maximum wait time in ms
   * @returns {Promise<{ iframe: HTMLIFrameElement, container: HTMLElement, document: Document }>} Resolves with iframe references ready for capture
   */
  const createVirtualContent = async (url, options = {}) => {
    const { containerSelector = EXPORT_CONTAINER_SELECTOR, timeout = DEFAULT_IFRAME_TIMEOUT_MS } = options;

    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');

      // Configure iframe offscreen (headless capture)
      iframe.style.position = 'absolute';
      iframe.style.left = '-99999px';
      iframe.style.top = '0';
      iframe.style.visibility = 'hidden';
      iframe.style.pointerEvents = 'none';

      iframe.style.width = '1600px';
      iframe.style.height = '1000px';
      iframe.style.border = 'none';

      let iframeDoc = null;
      let messageListener = null;
      let isResolved = false;

      messageListener = async (event) => {
        try {
          const isFromIframe = event?.source === iframe.contentWindow;
          if (!isFromIframe) return; // ignore HMR/other messages
          const isSameOrigin = event?.origin === window.location.origin;
          if (!isSameOrigin) return;
          const isPageLoaded = event?.data?.type === 'page:loaded';
          if (!isPageLoaded) return;

          // Lazily acquire iframe document in case onload hasn't set it yet
          iframeDoc = iframeDoc || iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            throw new Error('iFrame document no longer available.');
          }

          // Retry container query a few times in case DOM is settling
          const maxAttempts = 5;
          const delay = (ms) => new Promise((r) => setTimeout(r, ms));
          let container = null;
          for (let i = 0; i < maxAttempts; i++) {
            container = iframeDoc.querySelector(containerSelector);
            if (container) break;
            await delay(50);
          }

          if (!container) {
            throw new Error(`Could not find container within iFrame ${containerSelector}`);
          }

          handleSuccess(container);
        } catch (error) {
          handleError(error);
        }
      };

      const cleanup = () => {
        if (messageListener) {
          window.removeEventListener('message', messageListener);
        }
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      const handleError = (error) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        cleanup();
        reject(error);
      };

      const handleSuccess = (container) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);

        // Remove the event listener but keep iframe for PDF generation
        window.removeEventListener('message', messageListener);
        messageListener = null;
        resolve({ iframe, container, document: iframeDoc });
      };

      const timeoutId = setTimeout(() => {
        handleError(new Error('Timed out loading content.'));
      }, timeout);

      window.addEventListener('message', messageListener);

      iframe.onload = () => {
        try {
          iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

          if (!iframeDoc) {
            handleError(new Error('Could not access iFrame document.'));
            return;
          }
        } catch (error) {
          handleError(error);
        }
      };

      iframe.onerror = () => {
        handleError(new Error('Failed to load iFrame content.'));
      };

      document.body.appendChild(iframe);
      iframe.src = url;
    });
  };

  /**
   * Generate PDF blobs from multiple URLs and package them into a ZIP file.
   *
   * Each URL is loaded into an offscreen iframe. Once the page signals loaded,
   * we capture its Paged.js-rendered pages and add the PDF blob to a zip.
   *
   * @param {Object[]} items - Items to export (your data model for students/users)
   * @param {Function} urlGenerator - Returns the URL for a given item
   * @param {Function} filenameGenerator - Returns the file name for a given item
   * @param {Object} [options]
   * @param {string} [options.containerSelector='[data-pdf-export-container]'] - Selector for the container to capture
   * @param {string} [options.zipFilename='documents.zip'] - Name of the generated ZIP file
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<void>} Resolves when the ZIP has been generated and download triggered
   */
  const generateBulkDocuments = async (items, urlGenerator, filenameGenerator, options = {}) => {
    const {
      containerSelector = EXPORT_CONTAINER_SELECTOR,
      zipFilename = DEFAULT_BULK_EXPORT_FILENAME,
      onProgress,
    } = options;

    const zip = new JSZip();
    const errors = [];
    let completed = 0;

    for (const item of items) {
      try {
        const filename = filenameGenerator(item);

        onProgress?.({
          completed,
          total: items.length,
          percentage: Math.round((completed / items.length) * 100),
          current: filename,
          errors: [...errors],
        });

        const url = urlGenerator(item);

        const { iframe, container } = await createVirtualContent(url, {
          containerSelector,
        });

        const pdfBlob = await generateDocument([container], '', { returnBlob: true });
        if (!pdfBlob || pdfBlob.size === 0) throw new Error('Generated PDF blob is empty.');

        zip.file(filename, pdfBlob);

        iframe.parentNode.removeChild(iframe);
        const delay = 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        completed++;
      } catch (error) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
        console.error(`Export failed for student ${item.id}:`, error);

        errors.push({
          studentId: item.id || 'unknown',
          studentName: `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.username || item.id,
          message: errorMessage,
        });

        completed++;
      }
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, zipFilename);
    } catch (error) {
      console.error('Failed to create and download ZIP file:', error);
      throw new Error('Failed to create and download ZIP file.');
    }

    onProgress?.({
      completed,
      total: items.length,
      percentage: 100,
      errors: [...errors],
    });
  };

  return {
    generateDocument,
    generateBulkDocuments,
  };
})();

export default PdfExportService;
