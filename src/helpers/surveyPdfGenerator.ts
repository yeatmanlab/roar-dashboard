import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface GeneratePdfOptions {
  filename?: string;
  margin?: number;
  title?: string;
}

interface SurveyElement {
  name?: string;
  title?: string;
  type?: string;
}

interface SurveyPage {
  title?: string;
  elements?: SurveyElement[];
}

interface SurveyJson {
  title?: string;
  pages?: SurveyPage[];
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line) => {
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
}

export async function generateSurveyPdfFromJson(
  survey: SurveyJson,
  options: GeneratePdfOptions = {},
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const filename = options.filename ?? 'survey.pdf';
  const margin = options.margin ?? 48; // pts
  const title = options.title ?? survey.title ?? 'Survey';

  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - margin * 2;
  let cursorY = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  cursorY = addWrappedText(doc, title, margin, cursorY, usableWidth, 20) + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);

  const pages = survey.pages ?? [];
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
      cursorY = margin;
    }
    const pageTitle = page.title ? `Page ${pageIndex + 1}: ${page.title}` : `Page ${pageIndex + 1}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    cursorY = addWrappedText(doc, pageTitle, margin, cursorY, usableWidth, 18) + 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    (page.elements ?? []).forEach((el, i) => {
      const questionLabel = `${i + 1}. ${el.title ?? el.name ?? 'Untitled question'}`;
      cursorY = addWrappedText(doc, questionLabel, margin, cursorY, usableWidth, 16) + 8;
      // Leave some space for answer area
      const answerBoxHeight = 20;
      doc.rect(margin, cursorY, usableWidth, answerBoxHeight);
      cursorY += answerBoxHeight + 12;
    });
  });

  const blob = doc.output('blob');
  // Trigger download if running in browser context
  if (typeof window !== 'undefined' && window?.URL) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return blob;
}

export async function appendElementAsImage(
  doc: jsPDF,
  element: HTMLElement,
  margin = 48,
): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const ratio = canvas.height / canvas.width;
  const imgWidth = usableWidth;
  const imgHeight = imgWidth * ratio;

  // Add a new page and place the image centered horizontally
  doc.addPage();
  const x = margin;
  const y = margin;
  // Ensure the image fits within page height; if too tall, scale down
  const maxHeight = pageHeight - margin * 2;
  const scale = imgHeight > maxHeight ? maxHeight / imgHeight : 1;
  doc.addImage(imgData, 'PNG', x, y, imgWidth * scale, imgHeight * scale);
}

export default {
  generateSurveyPdfFromJson,
  appendElementAsImage,
};

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface SurveyPdfOptions {
  filename?: string
  margin?: number
  title?: string
}

/**
 * Render a SurveyJS JSON definition into a simple PDF.
 * This does not mount SurveyJS UI; it prints titles, pages, and questions as text.
 */
export async function generateSurveyPdfFromJson(
  surveyJson: any,
  opts: SurveyPdfOptions = {}
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = opts.margin ?? 36

  let cursorY = margin
  const lineHeight = 18
  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - margin * 2

  const writeWrapped = (text: string, bold = false) => {
    if (bold) doc.setFont(undefined, 'bold')
    const lines = doc.splitTextToSize(text, usableWidth)
    lines.forEach((line: string) => {
      if (cursorY > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        cursorY = margin
      }
      doc.text(line, margin, cursorY)
      cursorY += lineHeight
    })
    if (bold) doc.setFont(undefined, 'normal')
  }

  // Title
  const title = opts.title ?? surveyJson?.title ?? 'Survey'
  doc.setFontSize(16)
  writeWrapped(String(title), true)
  cursorY += 6
  doc.setFontSize(12)

  const pages: any[] = Array.isArray(surveyJson?.pages) ? surveyJson.pages : []
  pages.forEach((page, pageIdx) => {
    writeWrapped(`Page ${pageIdx + 1}: ${page.title ?? ''}`, true)
    const elements: any[] = Array.isArray(page?.elements) ? page.elements : []
    elements.forEach((el) => {
      const name = el?.name ?? '(unnamed)'
      const title = typeof el?.title === 'string' ? el.title : el?.title?.default ?? ''
      writeWrapped(`• ${title || name}`)
      if (el?.choices && Array.isArray(el.choices)) {
        const choices = el.choices.map((c: any) => (typeof c === 'string' ? c : c?.text ?? c?.value)).filter(Boolean)
        if (choices.length) writeWrapped(`  - Choices: ${choices.join(', ')}`)
      }
    })
    cursorY += lineHeight / 2
  })

  if (opts.filename) {
    doc.save(opts.filename)
  }
  return doc
}

/**
 * Utility to capture any element as an image and append to PDF (1 page).
 */
export async function appendElementAsImage(doc: jsPDF, element: HTMLElement, margin = 36): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - margin * 2

  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight)

  const drawWidth = imgWidth * ratio
  const drawHeight = imgHeight * ratio
  const x = (pageWidth - drawWidth) / 2
  const y = (pageHeight - drawHeight) / 2

  doc.addImage(imgData, 'PNG', x, y, drawWidth, drawHeight)
}


