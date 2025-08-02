import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// US Letter size in mm (215.9 x 279.4 mm)
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;
const MARGIN = 12.7; // 0.5 inch margin
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const EXPORT_CONTAINER_SELECTOR = '[data-pdf-export-container]';
const EXPORT_SECTION_SELECTOR = '[data-pdf-export-section]';
const DEFAULT_BULK_EXPORT_FILENAME = 'documents.zip';

const PdfExportService = (() => {
  // Calculate scale factor based on element width and target PDF width
  const calculateScaleFactor = (width) => CONTENT_WIDTH / width;

  /**
   * Helper function to add an element to a document and perform page break logic.
   *
   * @param {HTMLElement} element – The element to add to the document.
   * @param {jsPDF} document – The document to add the element to.
   * @param {Number} yCounter – The current y position in the document.
   * @param {Number} offset – The offset to add to the y position.
   * @returns {Number} The new yCounter value
   */
  const addElementToPdf = async (element, document, yCounter, offset = 0) => {
    // Configure html2canvas for high resolution
    const options = {
      logging: true,
      scale: 3,
      windowWidth: 1300,
      letterRendering: true,
    };

    await html2canvas(element, options).then(function (canvas) {
      // Use higher quality setting (1.0) for the image
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const scaledCanvasHeight = canvas.height * calculateScaleFactor(canvas.width);

      // Add a new page if there's not enough space
      // Calculate available space (accounting for top and bottom margins)
      const availableHeight = PAGE_HEIGHT - MARGIN * 2;
      const currentPosition = yCounter - MARGIN; // Position relative to content area
      const remainingSpace = availableHeight - currentPosition;
      const requiredSpace = scaledCanvasHeight + offset;

      if (requiredSpace > remainingSpace) {
        document.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'mm');
        yCounter = MARGIN;
      }

      document.addImage(imgData, 'PNG', MARGIN, yCounter, CONTENT_WIDTH, scaledCanvasHeight);
      yCounter += scaledCanvasHeight;
    });

    return yCounter;
  };

  /**
   * Generates a PDF document from a list of DOM elements.
   *
   * @param {Object} elements - DOM elements to include in the PDF.
   * @param {String} fileName - Name for the exported file.
   * @param {Object} options - Optional configuration parameters.
   * @param {String} options.orientation - Page orientation ('portrait' or 'landscape').
   * @param {String} options.format - Paper format (default: 'letter').
   * @param {Boolean} options.returnBlob - If true, returns a blob instead of downloading (default: false).
   * @returns {Promise<void|Blob>} Promise that resolves when the document is generated and downloaded, or returns a blob if returnBlob is true.
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

    // Add elements to the PDF
    for (const element of elements) {
      yCounter = await addElementToPdf(element, doc, yCounter);
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
   * Creates a virtual iframe to load content for PDF generation
   *
   * @param {String} url - The URL to load in the iframe
   * @param {String} containerSelector - CSS selector for the container element (default: '[data-pdf-export-container]')
   * @param {Boolean} debug - Whether to make iframe visible for debugging (default: false)
   * @param {Number} timeout - Maximum time to wait for loading (default: 30000ms)
   * @returns {Promise<Object>} Promise that resolves with { iframe, container, document }
   */
  const createVirtualContent = async (url, options = {}) => {
    const { containerSelector = EXPORT_CONTAINER_SELECTOR, debug = false, timeout = 30000 } = options;

    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');

      // Configure iframe visibility
      if (debug) {
        iframe.style.position = 'fixed';
        iframe.style.top = '50px';
        iframe.style.left = '50px';
        iframe.style.width = '1000px';
        iframe.style.height = '700px';
        iframe.style.border = '3px solid grey';
        iframe.style.zIndex = '9999';
        iframe.style.backgroundColor = 'white';
      } else {
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.width = '1200px';
        iframe.style.height = '800px';
        iframe.style.border = 'none';
      }

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
   * Generates PDF blobs from multiple URLs and packages them into a ZIP file
   *
   * @param {Array} items - Array of items to export
   * @param {Function} urlGenerator - Function that takes an item and returns the URL to load
   * @param {Function} filenameGenerator - Function that takes an item and returns the filename
   * @param {Object} options - Configuration options
   * @param {String} options.containerSelector - CSS selector for the container element
   * @param {String} options.sectionSelector - CSS selector for PDF sections (default: '[data-pdf-export-section]')
   * @param {String} options.zipFilename - Name for the ZIP file
   * @param {Function} options.onProgress - Progress callback function
   * @param {Boolean} options.debug - Whether to make iframes visible for debugging
   * @returns {Promise<void>} Promise that resolves when ZIP is downloaded
   */
  const generateBulkDocuments = async (items, urlGenerator, filenameGenerator, options = {}) => {
    const {
      containerSelector = EXPORT_CONTAINER_SELECTOR,
      sectionSelector = EXPORT_SECTION_SELECTOR,
      zipFilename = DEFAULT_BULK_EXPORT_FILENAME,
      onProgress,
      debug = false,
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
          debug,
        });

        const sections = container.querySelectorAll(sectionSelector);
        if (!sections.length) throw new Error('No sections found within document');
        const elements = Array.from(sections);

        const pdfBlob = await generateDocument(elements, '', { returnBlob: true });
        if (!pdfBlob || pdfBlob.size === 0) throw new Error('Generated PDF blob is empty');

        zip.file(filename, pdfBlob);

        iframe.parentNode.removeChild(iframe);
        completed++;

        const delay = 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
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
    createVirtualContent,
    generateBulkDocuments,
  };
})();

export default PdfExportService;
