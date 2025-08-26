import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import PdfExportService from '@/services/PdfExport.service';

// Create mock instances
const mockJsPdfInstance = {
  addPage: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
};

const mockCanvasInstance = {
  height: 1000,
  width: 800,
  toDataURL: vi.fn().mockReturnValue('mock-image-data'),
};

// Mock dependencies
vi.mock('jspdf', () => ({
  default: vi.fn(() => mockJsPdfInstance),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve(mockCanvasInstance)),
}));

describe('PdfExportService', () => {
  let mockElements;
  let consoleSpy;

  beforeEach(() => {
    // Mock DOM elements with realistic properties
    mockElements = [
      { offsetWidth: 800, offsetHeight: 1000 },
      { offsetWidth: 800, offsetHeight: 500 },
    ];

    // Spy on console.log to verify logging
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset all mocks between tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('generateDocument', () => {
    it('should generate a PDF document with default options', async () => {
      const fileName = 'test-document.pdf';
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      await PdfExportService.generateDocument(mockElements, fileName);

      // Verify jsPDF was initialized with correct default options
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
        compress: true,
        precision: 16,
        hotfixes: ['px_scaling'],
      });

      // Verify html2canvas was called for each element with correct options
      expect(html2canvas).toHaveBeenCalledTimes(mockElements.length);
      expect(html2canvas).toHaveBeenCalledWith(
        mockElements[0],
        expect.objectContaining({
          scale: 3,
          windowWidth: 1300,
          letterRendering: true,
        }),
      );

      // Verify save was called with correct filename
      expect(mockJsPdfInstance.save).toHaveBeenCalledWith(fileName);
    });

    it('should generate a PDF document with custom options', async () => {
      const fileName = `mock-${nanoid()}-document.pdf`;
      const options = {
        orientation: 'landscape',
        format: 'a4',
      };
      const { default: jsPDF } = await import('jspdf');

      await PdfExportService.generateDocument(mockElements, fileName, options);

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

    it('should add a new page when content exceeds page height', async () => {
      const fileName = `mock-${nanoid()}-document.pdf`;

      // Setup html2canvas to return a very tall canvas for this test
      const tallCanvasInstance = {
        height: 75000, // Very tall canvas that will exceed page height
        width: 800,
        toDataURL: vi.fn().mockReturnValue('mock-image-data'),
      };

      const { default: html2canvas } = await import('html2canvas');
      html2canvas.mockImplementationOnce(() => Promise.resolve(tallCanvasInstance));

      await PdfExportService.generateDocument([mockElements[0]], fileName);

      // Verify addPage was called with correct page size
      expect(mockJsPdfInstance.addPage).toHaveBeenCalled();
      expect(mockJsPdfInstance.addPage).toHaveBeenCalledWith([215.9, 279.4], 'mm');
    });

    it('should handle empty elements array', async () => {
      const fileName = `mock-${nanoid()}-document.pdf`;
      const { default: html2canvas } = await import('html2canvas');

      await PdfExportService.generateDocument([], fileName);

      expect(html2canvas).not.toHaveBeenCalled();
      expect(mockJsPdfInstance.save).toHaveBeenCalledWith(fileName);
    });

    it('should calculate scale factor based on element width and target PDF width', async () => {
      const fileName = 'mock-test-document.pdf';
      const narrowElement = { offsetWidth: 400, offsetHeight: 500 }; // Half the width of regular elements

      const narrowCanvasInstance = {
        height: 500,
        width: 400,
        toDataURL: vi.fn().mockReturnValue('mock-image-data'),
      };

      const { default: html2canvas } = await import('html2canvas');
      html2canvas.mockImplementationOnce(() => Promise.resolve(narrowCanvasInstance));

      await PdfExportService.generateDocument([narrowElement], fileName);

      // The content width is PAGE_WIDTH (215.9) - MARGIN (12.7) * 2 = 190.5
      // Scale factor for width 400 should be 190.5/400 = 0.47625
      // So the scaled height should be 500 * 0.47625 = 238.125
      expect(mockJsPdfInstance.addImage).toHaveBeenCalledWith(
        'mock-image-data',
        'PNG',
        12.7, // MARGIN
        12.7, // MARGIN (initial yCounter)
        190.5, // CONTENT_WIDTH
        expect.any(Number), // Scaled height
      );
    });

    it('should position elements sequentially in the document', async () => {
      const fileName = `mock-${nanoid()}-document.pdf`;

      const firstCanvasInstance = {
        height: 500,
        width: 800,
        toDataURL: vi.fn().mockReturnValue('mock-image-data-1'),
      };

      const secondCanvasInstance = {
        height: 300,
        width: 800,
        toDataURL: vi.fn().mockReturnValue('mock-image-data-2'),
      };

      const { default: html2canvas } = await import('html2canvas');
      html2canvas
        .mockImplementationOnce(() => Promise.resolve(firstCanvasInstance))
        .mockImplementationOnce(() => Promise.resolve(secondCanvasInstance));

      await PdfExportService.generateDocument(mockElements, fileName);

      // Check that addImage was called twice with different y positions
      const calls = mockJsPdfInstance.addImage.mock.calls;
      expect(calls.length).toBe(2);

      // First element should be positioned at MARGIN (12.7)
      expect(calls[0][2]).toBe(12.7); // x position
      expect(calls[0][3]).toBe(12.7); // y position

      // Second element should be positioned below the first one
      expect(calls[1][2]).toBe(12.7); // x position
      expect(calls[1][3]).toBeGreaterThan(12.7); // y position should be greater
    });
  });

  describe('error handling', () => {
    it('should handle html2canvas errors gracefully', async () => {
      const fileName = `mock-${nanoid()}-document.pdf`;
      const error = new Error('Canvas rendering failed');

      const { default: html2canvas } = await import('html2canvas');
      html2canvas.mockImplementationOnce(() => Promise.reject(error));

      await expect(PdfExportService.generateDocument(mockElements, fileName)).rejects.toThrow(
        'Canvas rendering failed',
      );
    });

    it('should handle invalid elements parameter', async () => {
      const fileName = `mock-${nanoid()}-document.pdf`;
      const invalidElements = 'not-an-array';

      await expect(PdfExportService.generateDocument(invalidElements, fileName)).resolves.toBeUndefined();
    });
  });
});
