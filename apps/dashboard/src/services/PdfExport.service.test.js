import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PdfExportService from '@/services/PdfExport.service';

// Create mock instances
const mockJsPdfInstance = {
  addPage: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
  output: vi.fn().mockReturnValue(new Blob(['mock-pdf-content'], { type: 'application/pdf' })),
};

const mockCanvasInstance = {
  height: 1000,
  width: 800,
  toDataURL: vi.fn().mockReturnValue('mock-image-data'),
};

const mockZipInstance = {
  file: vi.fn(),
  generateAsync: vi.fn().mockResolvedValue(new Blob(['mock-zip-content'], { type: 'application/zip' })),
};

// Mock dependencies
vi.mock('jspdf', () => ({
  default: vi.fn(() => mockJsPdfInstance),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve(mockCanvasInstance)),
}));

vi.mock('jszip', () => ({
  default: vi.fn(() => mockZipInstance),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

describe('PdfExportService', () => {
  let mockDocument;
  let mockPages;
  let consoleDebugSpy;

  beforeEach(() => {
    // Mock Paged.js rendered pages
    mockPages = [
      { classList: { contains: vi.fn().mockReturnValue(true) }, ownerDocument: null },
      { classList: { contains: vi.fn().mockReturnValue(true) }, ownerDocument: null },
    ];

    // Mock document with Paged.js page structure
    mockDocument = {
      querySelectorAll: vi.fn((selector) => {
        if (selector === '.pagedjs_pages .pagedjs_page') {
          return mockPages;
        }
        return [];
      }),
      querySelector: vi.fn(),
    };

    // Mock elements to resolve ownerDocument
    mockPages.forEach((page) => {
      page.ownerDocument = mockDocument;
    });

    // Spy on console.debug to verify logging
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // Reset all mocks between tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  describe('generateDocument', () => {
    it('should generate a PDF document with default options', async () => {
      const fileName = 'test-document.pdf';
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      await PdfExportService.generateDocument(mockPages, fileName);

      // Verify jsPDF was initialized with correct default options
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
        compress: true,
        precision: 16,
        hotfixes: ['px_scaling'],
      });

      // Verify html2canvas was called for each page with correct options
      expect(html2canvas).toHaveBeenCalledTimes(mockPages.length);
      expect(html2canvas).toHaveBeenCalledWith(
        mockPages[0],
        expect.objectContaining({
          scale: 3,
          windowWidth: 1440,
          letterRendering: true,
          useCORS: true,
          logging: false,
        }),
      );

      // Verify save was called with correct filename
      expect(mockJsPdfInstance.save).toHaveBeenCalledWith(fileName);
    });

    it('should generate a PDF document with custom options', async () => {
      const fileName = 'test-landscape-document.pdf';
      const options = {
        orientation: 'landscape',
        format: 'a4',
      };
      const { default: jsPDF } = await import('jspdf');

      await PdfExportService.generateDocument(mockPages, fileName, options);

      // Verify jsPDF was initialized with correct custom options
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
        precision: 16,
        hotfixes: ['px_scaling'],
      });
    });

    it('should add new pages for multiple paged elements', async () => {
      const fileName = 'test-multipage-document.pdf';

      await PdfExportService.generateDocument(mockPages, fileName);

      // Verify addPage was called for subsequent pages (not the first one)
      expect(mockJsPdfInstance.addPage).toHaveBeenCalledTimes(mockPages.length - 1);
      expect(mockJsPdfInstance.addPage).toHaveBeenCalledWith([215.9, 279.4], 'mm');
    });

    it('should throw error when no pages found', async () => {
      const fileName = 'test-no-pages.pdf';
      
      // Mock document with no pages
      const emptyMockDoc = {
        querySelectorAll: vi.fn(() => []),
      };

      await expect(
        PdfExportService.generateDocument([{ ownerDocument: emptyMockDoc }], fileName)
      ).rejects.toThrow('No pages found');
    });

    it('should return a blob when returnBlob option is true', async () => {
      const fileName = 'test-blob-document.pdf';
      const options = { returnBlob: true };

      const result = await PdfExportService.generateDocument(mockPages, fileName, options);

      // Verify output was called with 'blob' parameter
      expect(mockJsPdfInstance.output).toHaveBeenCalledWith('blob');
      
      // Verify save was NOT called when returning blob
      expect(mockJsPdfInstance.save).not.toHaveBeenCalled();
      
      // Verify blob was returned
      expect(result).toBeInstanceOf(Blob);
    });

    it('should add images at full page dimensions', async () => {
      const fileName = 'test-full-page.pdf';

      await PdfExportService.generateDocument(mockPages, fileName);

      // Check that addImage was called with full page dimensions
      const calls = mockJsPdfInstance.addImage.mock.calls;
      expect(calls.length).toBe(mockPages.length);

      // Each page should be positioned at (0, 0) with full page dimensions
      calls.forEach((call) => {
        expect(call[2]).toBe(0); // x position
        expect(call[3]).toBe(0); // y position
        expect(call[4]).toBe(215.9); // PAGE_WIDTH
        expect(call[5]).toBe(279.4); // PAGE_HEIGHT
      });
    });
  });

  describe('error handling', () => {
    it('should handle html2canvas errors gracefully', async () => {
      const fileName = 'test-error-document.pdf';
      const error = new Error('Canvas rendering failed');

      const { default: html2canvas } = await import('html2canvas');
      html2canvas.mockImplementationOnce(() => Promise.reject(error));

      await expect(PdfExportService.generateDocument(mockPages, fileName)).rejects.toThrow(
        'Canvas rendering failed',
      );
    });

    it('should log debug messages during generation', async () => {
      const fileName = 'test-logging-document.pdf';

      await PdfExportService.generateDocument(mockPages, fileName);

      // Verify debug logging was called
      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[PDF Export]',
        'generateDocument:start',
        expect.any(Object)
      );
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[PDF Export]',
        'generateDocument:end',
        expect.any(Object)
      );
    });
  });

  describe('generateBulkDocuments', () => {
    let mockItems;
    let urlGenerator;
    let filenameGenerator;

    beforeEach(() => {
      mockItems = [
        { id: '1', firstName: 'John', lastName: 'Doe' },
        { id: '2', firstName: 'Jane', lastName: 'Smith' },
      ];

      urlGenerator = vi.fn((item) => `https://example.com/report/${item.id}`);
      filenameGenerator = vi.fn((item) => `${item.firstName}_${item.lastName}.pdf`);

      // Mock global DOM methods for iframe creation
      global.document = {
        ...global.document,
        createElement: vi.fn(() => ({
          style: {},
          setAttribute: vi.fn(),
        })),
        body: {
          appendChild: vi.fn(),
        },
      };
    });

    it('should be defined and callable', () => {
      expect(PdfExportService.generateBulkDocuments).toBeDefined();
      expect(typeof PdfExportService.generateBulkDocuments).toBe('function');
    });
  });
});
