import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface SurveyPdfOptions {
  filename?: string;
  margin?: number;
  title?: string;
}

// Render a SurveyJS JSON definition into a simple PDF (text-only summary)
export async function generateSurveyPdfFromJson(surveyJson: any, opts: SurveyPdfOptions = {}): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = opts.margin ?? 36;

  let cursorY = margin;
  const lineHeight = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - margin * 2;

  const writeWrapped = (text: string, bold = false) => {
    if (bold) doc.setFont(undefined, 'bold');
    const lines = doc.splitTextToSize(text, usableWidth);
    lines.forEach((line: string) => {
      if (cursorY > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    });
    if (bold) doc.setFont(undefined, 'normal');
  };

  const title = opts.title ?? surveyJson?.title ?? 'Survey';
  doc.setFontSize(16);
  writeWrapped(String(title), true);
  cursorY += 6;
  doc.setFontSize(12);

  const pages: any[] = Array.isArray(surveyJson?.pages) ? surveyJson.pages : [];
  pages.forEach((page, pageIdx) => {
    writeWrapped(`Page ${pageIdx + 1}: ${page.title ?? ''}`, true);
    const elements: any[] = Array.isArray(page?.elements) ? page.elements : [];
    elements.forEach((el) => {
      const name = el?.name ?? '(unnamed)';
      const qTitle = typeof el?.title === 'string' ? el.title : el?.title?.default ?? '';
      writeWrapped(`• ${qTitle || name}`);
      if (el?.choices && Array.isArray(el.choices)) {
        const choices = el.choices.map((c: any) => (typeof c === 'string' ? c : c?.text ?? c?.value)).filter(Boolean);
        if (choices.length) writeWrapped(`  - Choices: ${choices.join(', ')}`);
      }
    });
    cursorY += lineHeight / 2;
  });

  if (opts.filename) {
    doc.save(opts.filename);
  }
  return doc;
}

// Capture an element as an image and append it to the current PDF page, centered
export async function appendElementAsImage(doc: jsPDF, element: HTMLElement, margin = 36): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);

  const drawWidth = imgWidth * ratio;
  const drawHeight = imgHeight * ratio;
  const x = (pageWidth - drawWidth) / 2;
  const y = (pageHeight - drawHeight) / 2;

  doc.addImage(imgData, 'PNG', x, y, drawWidth, drawHeight);
}

// Fetch Survey JSON by URL and render to PDF
export async function generateSurveyPdfFromUrl(url: string, opts: SurveyPdfOptions = {}): Promise<jsPDF> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch survey JSON from ${url}: ${res.status}`);
  const json = await res.json();
  return generateSurveyPdfFromJson(json, opts);
}

// Trigger a download for an existing jsPDF instance
export function downloadPdf(doc: jsPDF, filename = 'survey.pdf'): void {
  doc.save(filename);
}

export default {
  generateSurveyPdfFromJson,
  appendElementAsImage,
  generateSurveyPdfFromUrl,
  downloadPdf,
};
