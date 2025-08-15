import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PdfExportService = (() => {
  // US Letter size in mm (215.9 x 279.4 mm)
  const PAGE_WIDTH = 215.9;
  const PAGE_HEIGHT = 279.4;
  const MARGIN = 12.7; // 0.5 inch margin
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

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
   * @returns {Promise<void>} Promise that resolves when the document is generated and downloaded.
   */
  const generateDocument = async (elements, fileName, options = {}) => {
    // Set default options
    const orientation = options.orientation || 'portrait';
    const format = options.format || 'letter';

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

    // Save and download the document
    doc.save(fileName);
  };

  return {
    generateDocument,
  };
})();

export default PdfExportService;
