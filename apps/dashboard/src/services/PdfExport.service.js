import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { SCORE_REPORT_SECTIONS_EXPANDED_URL_PARAM } from '../constants/scores';

// US Letter size in mm (215.9 x 279.4 mm)
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;
const MARGIN = 12.7; // 0.5 inch margin
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const EXPORT_CONTAINER_SELECTOR = '[data-pdf-export-container]';
const EXPORT_SECTION_SELECTOR = '[data-pdf-export-section]';
const DEFAULT_BULK_EXPORT_FILENAME = 'documents.zip';

/**
 * PDF export utilities for rendering DOM content into paginated PDF documents.
 *
 * This module uses html2canvas to rasterize DOM nodes and jsPDF to compose pages.
 * It supports:
 * - Atomic block placement with automatic page breaks
 * - Fallback slicing for oversized content
 * - Optional explicit chunking via `[data-pdf-export-chunk]`
 * - Responsive grid row detection (keeps rows together without altering DOM)
 */
const PdfExportService = (() => {
  // Tunable constants for pagination/capture behavior
  const EPSILON_MM = 0.5; // extra margin near page bottom to avoid peeking
  const EXTRA_BLEED_PX = 20; // extra bleed around detected rows to avoid clipping
  const H2C_WINDOW_WIDTH = 1440; // ensure export layout uses xl breakpoint (3 cols)

  /**
   * Calculate the scale factor based on the element width and target PDF width.
   
   * @param {number} width - The width of the element to scale.
   * @returns {number} The scale factor.
   */
  const calculateScaleFactor = (width) => {
    const w = Number(width);
    if (!Number.isFinite(w) || w <= 0) return 1; // fallback to 1:1 to avoid Infinity/NaN
    return CONTENT_WIDTH / w;
  };

  /**
   * Ensure the export/expanded flag is present so the child page expands itself for capture.
   *
   * @param {string} url - Absolute or relative URL to be loaded in the iframe
   * @returns {string} A URL string with the `expanded=true` query param
   */
  const withExportFlag = (url) => {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set(SCORE_REPORT_SECTIONS_EXPANDED_URL_PARAM, true);
    return parsed.toString();
  };

  /**
   * Render an element to a canvas using html2canvas with consistent options.
   *
   * @param {HTMLElement} element - The element to rasterize
   * @returns {Promise<HTMLCanvasElement>} A promise that resolves to the rendered canvas
   */
  const renderElementToCanvas = async (element) => {
    // Give charts/layout time to settle, and signal an optional pre-capture hook
    element?.ownerDocument?.defaultView?.dispatchEvent?.(new CustomEvent('roar:pdf-capture'));
    const awaitNextFrames = () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
    await awaitNextFrames();
    // Small fixed delay helps Chart.js finalize animations/layout if any remain
    await new Promise((r) => setTimeout(r, 120));
    const options = {
      logging: true,
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
   * Add a pre-rendered canvas to the PDF, slicing it across pages as needed.
   *
   * Slices the canvas vertically to fit remaining space, creating new pages as required.
   *
   * @param {jsPDF} pdf - jsPDF document instance
   * @param {HTMLCanvasElement} canvas - Full canvas to paginate
   * @param {number} yCounter - Current Y cursor in mm
   * @param {number} [offset=0] - Extra height to account for (mm)
   * @returns {number} Updated Y cursor (mm)
   */
  const addCanvasSliced = (pdf, canvas, yCounter, offset = 0) => {
    // Guard against zero-sized canvases
    if (
      !canvas ||
      !Number.isFinite(canvas.width) ||
      !Number.isFinite(canvas.height) ||
      canvas.width <= 0 ||
      canvas.height <= 0
    ) {
      return yCounter;
    }
    const scaleFactor = calculateScaleFactor(canvas.width); // mm per px at target width
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return yCounter;

    const totalHeightMm = canvas.height * scaleFactor;
    const availableHeightMm = PAGE_HEIGHT - MARGIN * 2;

    const getSliceDataUrl = (srcYpx, sliceHeightPx) => {
      const tempCanvas = window.document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = sliceHeightPx;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcYpx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
      return tempCanvas.toDataURL('image/jpeg', 1.0);
    };

    let remainingMm = totalHeightMm + offset;
    let srcYpx = 0;

    while (remainingMm > 0) {
      const currentPositionMm = yCounter - MARGIN;
      let freeSpaceMm = availableHeightMm - currentPositionMm;
      if (freeSpaceMm <= 0) {
        pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'mm');
        yCounter = MARGIN;
        freeSpaceMm = availableHeightMm;
      }

      // Leave a tiny epsilon to reduce rounding issues at page boundaries
      const epsilon = EPSILON_MM; // mm
      const placeMm = Math.max(0, Math.min(freeSpaceMm - epsilon, remainingMm));
      let sliceHeightPx = Math.max(1, Math.floor(placeMm / scaleFactor));
      const remainingPx = canvas.height - srcYpx;
      if (sliceHeightPx > remainingPx) sliceHeightPx = remainingPx;

      const sliceDataUrl = getSliceDataUrl(srcYpx, sliceHeightPx);
      const sliceHeightMm = sliceHeightPx * scaleFactor;
      // Final validation of dimensions prior to addImage
      if (sliceHeightMm > 0 && Number.isFinite(sliceHeightMm) && CONTENT_WIDTH > 0) {
        pdf.addImage(sliceDataUrl, 'JPEG', MARGIN, yCounter, CONTENT_WIDTH, sliceHeightMm);
      } else {
        break;
      }

      yCounter += sliceHeightMm;
      remainingMm -= sliceHeightMm;
      srcYpx += sliceHeightPx;
    }

    return yCounter;
  };

  /**
   * Add a DOM element as an atomic block
   *
   * If the element fits into the PDF page, place it whole. Otherwise start a new page, and if still too tall, fallback
   * to slicing.
   *
   * @param {HTMLElement} element - Element to add
   * @param {jsPDF} pdf - jsPDF document instance
   * @param {number} yCounter - Current Y cursor in mm
   * @returns {Promise<number>} Updated Y cursor (mm)
   */
  const addElementBlock = async (element, pdf, yCounter) => {
    const canvas = await renderElementToCanvas(element);
    if (
      !canvas ||
      !Number.isFinite(canvas.width) ||
      !Number.isFinite(canvas.height) ||
      canvas.width <= 0 ||
      canvas.height <= 0
    ) {
      return yCounter;
    }
    const scaleFactor = calculateScaleFactor(canvas.width);
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return yCounter;

    const blockHeightMm = canvas.height * scaleFactor;
    const availableHeightMm = PAGE_HEIGHT - MARGIN * 2;
    const currentPositionMm = yCounter - MARGIN;
    const freeSpaceMm = availableHeightMm - currentPositionMm;

    // If it fits on the current page, place it whole
    if (blockHeightMm <= freeSpaceMm) {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      if (blockHeightMm > 0 && Number.isFinite(blockHeightMm) && CONTENT_WIDTH > 0) {
        pdf.addImage(imgData, 'JPEG', MARGIN, yCounter, CONTENT_WIDTH, blockHeightMm);
      }
      return yCounter + blockHeightMm;
    }

    // If it doesn't fit but would fit on an empty page, start a new page and place whole
    if (blockHeightMm <= availableHeightMm) {
      pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'mm');
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      if (blockHeightMm > 0 && Number.isFinite(blockHeightMm) && CONTENT_WIDTH > 0) {
        pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, CONTENT_WIDTH, blockHeightMm);
      }
      return MARGIN + blockHeightMm;
    }

    // Fallback: slice across pages
    return addCanvasSliced(pdf, canvas, yCounter);
  };

  /**
   * Add a pre-rendered portion (slice) of a canvas as an atomic block.
   *
   * Attempts to place on the current page, otherwise on a fresh page, finally
   * falls back to pagination if the slice itself is taller than the page.
   *
   * @param {jsPDF} pdf - jsPDF document instance
   * @param {HTMLCanvasElement} fullCanvas - Full source canvas
   * @param {number} srcYpx - Source Y in canvas pixels
   * @param {number} sliceHeightPx - Height of the slice in canvas pixels
   * @param {number} yCounter - Current Y cursor in mm
   * @returns {number} Updated Y cursor (mm)
   */
  const addCanvasSliceBlock = (pdf, fullCanvas, srcYpx, sliceHeightPx, yCounter) => {
    if (sliceHeightPx <= 0) return yCounter;
    const scaleFactor = calculateScaleFactor(fullCanvas.width);
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return yCounter;

    const availableHeightMm = PAGE_HEIGHT - MARGIN * 2;

    // Create a slice data URL for the requested region
    const makeSliceDataUrl = () => {
      const temp = window.document.createElement('canvas');
      temp.width = fullCanvas.width;
      temp.height = sliceHeightPx;
      const ctx = temp.getContext('2d');
      ctx.drawImage(fullCanvas, 0, srcYpx, fullCanvas.width, sliceHeightPx, 0, 0, fullCanvas.width, sliceHeightPx);
      return temp.toDataURL('image/jpeg', 1.0);
    };

    const sliceHeightMm = sliceHeightPx * scaleFactor;
    const currentPositionMm = yCounter - MARGIN;
    const freeSpaceMm = availableHeightMm - currentPositionMm;

    if (sliceHeightMm <= freeSpaceMm) {
      const dataUrl = makeSliceDataUrl();
      pdf.addImage(dataUrl, 'JPEG', MARGIN, yCounter, CONTENT_WIDTH, sliceHeightMm);
      return yCounter + sliceHeightMm;
    }

    if (sliceHeightMm <= availableHeightMm) {
      pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'mm');
      const dataUrl = makeSliceDataUrl();
      pdf.addImage(dataUrl, 'JPEG', MARGIN, MARGIN, CONTENT_WIDTH, sliceHeightMm);
      return MARGIN + sliceHeightMm;
    }

    // Fallback: if the slice itself is taller than a page, paginate it
    const temp = window.document.createElement('canvas');
    temp.width = fullCanvas.width;
    temp.height = sliceHeightPx;
    temp
      .getContext('2d')
      .drawImage(fullCanvas, 0, srcYpx, fullCanvas.width, sliceHeightPx, 0, 0, fullCanvas.width, sliceHeightPx);
    return addCanvasSliced(pdf, temp, yCounter);
  };

  /**
   * Detect actual responsive grid rows (by offsetTop) and render each row as an atomic block
   * without altering the DOM structure. Uses a single canvas render of the entire element
   * and crops row slices based on measured DOM positions.
   *
   * @param {HTMLElement} element - Section element containing a `.grid` descendant
   * @param {jsPDF} pdf - jsPDF document instance
   * @param {number} yCounter - Current Y cursor in mm
   * @returns {Promise<number>} Updated Y cursor (mm)
   */
  const addGridByDetectedRows = async (element, pdf, yCounter) => {
    // Find the closest/outer grid within this section (smallest DOM depth from element)
    let grid = element.querySelector?.('.grid');
    const allGrids = Array.from(element.querySelectorAll?.('.grid') || []);
    if (allGrids.length > 0) {
      const distanceFrom = (root, node) => {
        let d = 0,
          n = node;
        while (n && n !== root) {
          n = n.parentElement;
          d++;
        }
        return n === root ? d : Number.MAX_SAFE_INTEGER;
      };
      grid = allGrids.reduce((best, cur) => {
        const bd = best ? distanceFrom(element, best) : Number.MAX_SAFE_INTEGER;
        const cd = distanceFrom(element, cur);
        return cd < bd ? cur : best || cur;
      }, grid || allGrids[0]);
    }
    if (!grid) {
      // Fallback to default block behavior
      return addElementBlock(element, pdf, yCounter);
    }

    // Render the whole element once for coordinate mapping
    const canvas = await renderElementToCanvas(element);
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return yCounter;

    // Map DOM px to canvas px
    const elRect = element.getBoundingClientRect();
    const ratio = canvas.height / Math.max(1, elRect.height);

    // Group grid children by their (approximately) equal top position (rows)
    const children = Array.from(grid.children).filter((n) => n.nodeType === 1);
    if (children.length === 0) return yCounter;

    // Tolerance in pixels to treat two tops as the same row (layout rounding)
    const TOP_TOL = 2;
    const rows = [];
    for (const child of children) {
      const style = window.getComputedStyle(child);
      const mt = parseFloat(style.marginTop || '0') || 0;
      const mb = parseFloat(style.marginBottom || '0') || 0;
      const rawTop = child.offsetTop; // relative to grid
      const top = Math.max(0, Math.round(rawTop - mt));
      const bottom = Math.round(rawTop + child.offsetHeight + mb);

      // Find an existing row within tolerance
      let group = rows.find((r) => Math.abs(r.top - top) <= TOP_TOL);
      if (!group) {
        group = { top, bottom };
        rows.push(group);
      } else {
        if (top < group.top) group.top = top;
        if (bottom > group.bottom) group.bottom = bottom;
      }
    }

    // Convert grid-relative coords to element-relative DOM px
    const gridTopInEl = grid.getBoundingClientRect().top - elRect.top;

    // Determine a bleed based on computed row gap to avoid clipping shadows/margins
    let rowGapPx = 8; // sensible default (Tailwind gap-2 ~ 0.5rem ~ 8px)

    const style = window.getComputedStyle(grid);
    const rg = parseFloat(style.rowGap || style.gap || '8');
    if (Number.isFinite(rg) && rg >= 0) rowGapPx = rg;

    // Extra padding to accommodate charts/canvas overflow and shadows
    const bleedPx = Math.max(12, Math.round(rowGapPx) + EXTRA_BLEED_PX);

    // 1) Add content BEFORE the grid (e.g., section headers/intro) if present
    const gridRect = grid.getBoundingClientRect();
    // gridTopInEl is already computed above in this function; reuse it to avoid shadowing
    const preTopInEl = Math.max(0, gridTopInEl - 8); // small guard
    if (preTopInEl > 4) {
      const preSrcY = Math.max(0, Math.floor(0 * ratio));
      let preHeightPx = Math.max(1, Math.ceil(preTopInEl * ratio));
      if (preSrcY + preHeightPx > canvas.height) preHeightPx = Math.max(1, canvas.height - preSrcY);
      yCounter = addCanvasSliceBlock(pdf, canvas, preSrcY, preHeightPx, yCounter);
    }

    // Sort rows by top coordinate to maintain visual order
    rows.sort((a, b) => a.top - b.top);

    let lastSrcEnd = 0; // canvas px end of previous slice

    for (const row of rows) {
      // Compute row bounds using the union of child bounding rects for accuracy
      const rowChildren = children.filter((child) => {
        const style = window.getComputedStyle(child);
        const mt = parseFloat(style.marginTop || '0') || 0;
        const mb = parseFloat(style.marginBottom || '0') || 0;
        const rawTop = child.offsetTop;
        const top = Math.max(0, Math.round(rawTop - mt));
        const bottom = Math.round(rawTop + child.offsetHeight + mb);
        return top >= row.top && bottom <= row.bottom;
      });

      let minTop = Infinity;
      let maxBottom = -Infinity;
      for (const ch of rowChildren) {
        const r = ch.getBoundingClientRect();
        minTop = Math.min(minTop, r.top);
        maxBottom = Math.max(maxBottom, r.bottom);
      }
      if (!isFinite(minTop) || !isFinite(maxBottom)) {
        minTop = gridTopInEl + row.top;
        maxBottom = gridTopInEl + row.bottom;
      } else {
        // Convert viewport coords to element-relative
        minTop = minTop - elRect.top;
        maxBottom = maxBottom - elRect.top;
      }

      let rowTopInElPx = Math.max(0, minTop - bleedPx);
      const rowBottomInElPx = Math.min(elRect.height, maxBottom + bleedPx);

      let srcYpx = Math.max(0, Math.floor(rowTopInElPx * ratio));
      let sliceHeightPx = Math.max(1, Math.ceil((rowBottomInElPx - rowTopInElPx) * ratio));

      // Clamp to canvas bounds
      if (srcYpx + sliceHeightPx > canvas.height) {
        sliceHeightPx = Math.max(1, canvas.height - srcYpx);
      }

      // Ensure slices do not overlap backward due to rounding
      if (srcYpx < lastSrcEnd) {
        const delta = lastSrcEnd - srcYpx;
        srcYpx = lastSrcEnd;
        sliceHeightPx = Math.max(1, sliceHeightPx - delta);
      }
      // Clamp first row's top so it never overlaps the pre-grid header slice
      const isFirstRow = rows[0] === row;
      if (isFirstRow) {
        const clampTopPx = Math.floor(gridTopInEl * ratio);
        if (srcYpx < clampTopPx) {
          const delta = clampTopPx - srcYpx;
          srcYpx = clampTopPx;
          sliceHeightPx = Math.max(1, sliceHeightPx - delta);
        }
      }
      // Avoid placing a row when remaining space is extremely tight (< 2mm)
      const scaleFactor = calculateScaleFactor(canvas.width);
      const sliceHeightMm = sliceHeightPx * scaleFactor;
      const availableHeightMm = PAGE_HEIGHT - MARGIN * 2;
      const currentPositionMm = yCounter - MARGIN;
      const freeSpaceMm = availableHeightMm - currentPositionMm;
      // If there isn't enough room for the slice plus a small bottom padding (1mm), move to next page
      const BOTTOM_PADDING_MM = 1;
      if (sliceHeightMm <= availableHeightMm && freeSpaceMm < sliceHeightMm + BOTTOM_PADDING_MM && freeSpaceMm > 0) {
        // Force to next page for a clean break
        pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'mm');
        yCounter = MARGIN;
      }
      yCounter = addCanvasSliceBlock(pdf, canvas, srcYpx, sliceHeightPx, yCounter);
      lastSrcEnd = srcYpx + sliceHeightPx;
    }

    // 3) Add content AFTER the grid (e.g., closing notes) if present
    const postStartInEl = Math.max(0, gridRect.bottom - elRect.top);
    const elHeight = elRect.height;
    if (postStartInEl < elHeight - 4) {
      const postSrcY = Math.max(0, Math.floor(postStartInEl * ratio));
      let postHeightPx = Math.max(1, Math.ceil((elHeight - postStartInEl) * ratio));
      if (postSrcY + postHeightPx > canvas.height) postHeightPx = Math.max(1, canvas.height - postSrcY);
      yCounter = addCanvasSliceBlock(pdf, canvas, postSrcY, postHeightPx, yCounter);
    }

    return yCounter;
  };

  /**
   * Generate a PDF document from a list of DOM elements.
   *
   * Behavior
   * - If a `.grid` is detected, rows are detected by offsetTop and kept together
   * - Otherwise: the element is added as a single block with fallback pagination
   *
   * @param {HTMLElement[]} elements - DOM elements to include in the PDF, in order
   * @param {string} fileName - File name for the exported PDF
   * @param {Object} [options] - Additional configuration
   * @param {('portrait'|'landscape')} [options.orientation='portrait'] - Page orientation
   * @param {('letter'|'a4'|string)} [options.format='letter'] - Paper format
   * @param {boolean} [options.returnBlob=false] - If true, return a Blob instead of triggering download
   * @returns {Promise<void|Blob>} Resolves after saving the file or returns a Blob when `returnBlob=true`
   */
  const generateDocument = async (elements, fileName, options = {}) => {
    // Set default options
    const orientation = options.orientation || 'portrait';
    const format = options.format || 'letter';
    const returnBlob = options.returnBlob || false;

    // Initialize PDF with proper page size
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format,
      compress: true, // Enable compression for smaller file size
      precision: 16, // Higher precision for better rendering
      hotfixes: ['px_scaling'], // Apply hotfix for pixel scaling issues
    });

    // Set initial y position with margin
    let yCounter = MARGIN;

    // Add elements to the PDF. If a responsive grid is detected, paginate by detected rows.
    for (const element of elements) {
      if (element.querySelector?.('.grid')) {
        yCounter = await addGridByDetectedRows(element, doc, yCounter);
      } else {
        yCounter = await addElementBlock(element, doc, yCounter);
      }
    }

    // Return blob or download based on options
    if (returnBlob) {
      return doc.output('blob');
    } else {
      // Save and download the document
      doc.save(fileName);
    }
  };

  /**
   * Create a virtual iframe to load content for PDF generation.
   *
   * The loaded page is expected to postMessage `{ type: 'page:loaded' }` once its
   * internal loading completes (we hook this in `StudentScoreReport.vue`).
   *
   * @param {string} url - URL to load in the iframe
   * @param {Object} [options]
   * @param {string} [options.containerSelector='[data-pdf-export-container]'] - Selector for the container to capture
   * @param {number} [options.timeout=30000] - Maximum wait time in ms
   * @returns {Promise<{ iframe: HTMLIFrameElement, container: HTMLElement, document: Document }>} Resolves with iframe references ready for capture
   */
  const createVirtualContent = async (url, options = {}) => {
    const { containerSelector = EXPORT_CONTAINER_SELECTOR, timeout = 30000 } = options;

    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');

      // Configure iframe offscreen (headless capture)
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      // Ensure we are past Tailwind's xl breakpoint so the grid renders 3 columns
      iframe.style.width = '1600px';
      iframe.style.height = '1000px';
      iframe.style.border = 'none';

      let iframeDoc = null;
      let messageListener = null;
      let isResolved = false;

      messageListener = (event) => {
        if (event.data?.type === 'page:loaded' && event.origin === window.origin) {
          try {
            if (!iframeDoc) {
              throw new Error('iFrame document no longer available');
            }

            const container = iframeDoc.querySelector(containerSelector);

            if (!container) {
              throw new Error(`Could not find container within iFrame ${containerSelector}`);
            }

            handleSuccess(container);
          } catch (error) {
            handleError(error);
          }
        }
      };

      const cleanup = () => {
        if (messageListener) {
          window.removeEventListener('message', messageListener);
        }
        iframe.parentNode.removeChild(iframe);
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
        handleError(new Error('Timeout loading content'));
      }, timeout);

      window.addEventListener('message', messageListener);

      iframe.onload = () => {
        try {
          iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

          if (!iframeDoc) {
            handleError(new Error('Could not access iframe document'));
            return;
          }
        } catch (error) {
          handleError(error);
        }
      };

      iframe.onerror = () => {
        handleError(new Error('Failed to load content'));
      };

      document.body.appendChild(iframe);
      iframe.src = url;
    });
  };

  /**
   * Generate PDF blobs from multiple URLs and package them into a ZIP file.
   *
   * Each URL is loaded into an offscreen iframe. Once the page signals loaded,
   * we select the capture container and its export sections, render to PDF, and
   * add the PDF blob to a zip.
   *
   * @param {Object[]} items - Items to export (your data model for students/users)
   * @param {Function} urlGenerator - Returns the URL for a given item
   * @param {Function} filenameGenerator - Returns the file name for a given item
   * @param {Object} [options]
   * @param {string} [options.containerSelector='[data-pdf-export-container]'] - Selector for the container to capture
   * @param {string} [options.sectionSelector='[data-pdf-export-section]'] - Selector for sections to include
   * @param {string} [options.zipFilename='documents.zip'] - Name of the generated ZIP file
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<void>} Resolves when the ZIP has been generated and download triggered
   */
  const generateBulkDocuments = async (items, urlGenerator, filenameGenerator, options = {}) => {
    const {
      containerSelector = EXPORT_CONTAINER_SELECTOR,
      sectionSelector = EXPORT_SECTION_SELECTOR,
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
        const exportUrl = withExportFlag(url);
        const { iframe, container } = await createVirtualContent(exportUrl, {
          containerSelector,
        });

        const sections = container.querySelectorAll(sectionSelector);
        if (!sections.length) throw new Error('No sections found within document');
        const elements = Array.from(sections);

        const pdfBlob = await generateDocument(elements, '', { returnBlob: true });
        if (!pdfBlob || pdfBlob.size === 0) throw new Error('Generated PDF blob is empty');

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
      throw new Error('Failed to create and download ZIP file');
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
