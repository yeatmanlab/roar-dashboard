import { jsPDF } from 'jspdf';

// Helper function to add logo to PDF
async function addLogoToPdf(pdf: jsPDF, x: number, y: number, logoUrl: string, width = 25, height = 15): Promise<void> {
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function() {
        try {
          const base64 = reader.result as string;
          pdf.addImage(base64, 'PNG', x, y, width, height);
          resolve();
        } catch (error) {
          console.warn('Could not add logo to PDF:', error);
          resolve(); // Continue without logo
        }
      };
      reader.onerror = () => {
        console.warn('Could not read logo file');
        resolve(); // Continue without logo
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Could not load logo:', error);
    // Continue without logo
  }
}

export interface SurveyPdfOptions {
  title?: string;
  includeQuestionNumbers?: boolean;
  includePages?: boolean;
  fontSize?: number;
  margin?: number;
  showChoices?: boolean;
  showDescriptions?: boolean;
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
}

export interface GeneratePdfResult {
  success: boolean;
  blob?: Blob;
  error?: string;
  filename?: string;
}

interface QuestionChoice {
  value: string | number;
  text: string;
}

interface ParsedQuestion {
  name: string;
  title: string;
  type: string;
  description?: string;
  choices?: QuestionChoice[];
  required?: boolean;
  placeholder?: string;
  inputType?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  rateMin?: number;
  rateMax?: number;
  rateStep?: number;
  minRateDescription?: string;
  maxRateDescription?: string;
  labelTrue?: string;
  labelFalse?: string;
  matrixRows?: QuestionChoice[];
}

interface ParsedPage {
  name: string;
  title?: string;
  description?: string;
  questions: ParsedQuestion[];
}

const defaultOptions: SurveyPdfOptions = {
  includeQuestionNumbers: true,
  includePages: true,
  fontSize: 10,
  margin: 20,
  showChoices: true,
  showDescriptions: true,
};

// Helper function to parse HTML and convert to plain text
function parseHtmlToText(html: string): string {
  if (!html) return '';
  
  // Simple HTML parsing - remove tags and clean up text
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
    .replace(/<\/p>/gi, '\n\n')     // Convert </p> to double newlines
    .replace(/<[^>]*>/g, '')        // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')        // Convert &nbsp; to spaces
    .replace(/&amp;/g, '&')         // Convert &amp; to &
    .replace(/&lt;/g, '<')          // Convert &lt; to <
    .replace(/&gt;/g, '>')          // Convert &gt; to >
    .replace(/\s+/g, ' ')           // Replace multiple whitespace with single space
    .trim();
  
  return text;
}

// Helper function to draw a numberline/slider
function drawNumberline(pdf: jsPDF, x: number, y: number, width = 120, min = 0, max = 10): number {
  const lineY = y;
  const lineStartX = x;
  const lineEndX = x + width;
  
  // Draw the main line
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.5);
  pdf.line(lineStartX, lineY, lineEndX, lineY);
  
  // Draw start and end markers
  pdf.line(lineStartX, lineY - 2, lineStartX, lineY + 2);
  pdf.line(lineEndX, lineY - 2, lineEndX, lineY + 2);
  
  // Add labels
  pdf.setFontSize(8);
  pdf.text(min.toString(), lineStartX - 2, lineY + 6);
  pdf.text(max.toString(), lineEndX - 2, lineY + 6);
  
  // Draw tick marks for intermediate values
  if (max - min <= 10) {
    for (let i = min + 1; i < max; i++) {
      const tickX = lineStartX + ((i - min) / (max - min)) * width;
      pdf.line(tickX, lineY - 1, tickX, lineY + 1);
      if (i % 2 === 0) { // Label every other tick
        pdf.text(i.toString(), tickX - 1, lineY + 6);
      }
    }
  }
  
  return lineY + 12; // Return next Y position
}

function parseQuestion(question: any): ParsedQuestion {
  // Helper function to extract text from multilingual objects
  const extractText = (textObj: any): string => {
    if (typeof textObj === 'string') {
      // If the text contains HTML, parse it to clean text
      if (textObj.includes('<') && textObj.includes('>')) {
        return parseHtmlToText(textObj);
      }
      return textObj;
    }
    if (typeof textObj === 'object' && textObj) {
      const text = textObj.default || textObj.en || textObj.es || textObj.de || Object.values(textObj)[0] || '';
      // If the text contains HTML, parse it to clean text
      if (text.includes('<') && text.includes('>')) {
        return parseHtmlToText(text);
      }
      return text;
    }
    return '';
  };

  const parsed: ParsedQuestion = {
    name: question.name || '',
    title: extractText(question.title) || question.name || '',
    type: question.type || 'text',
    description: extractText(question.description),
    required: question.isRequired || false,
    inputType: question.inputType,
    min: question.min,
    max: question.max,
  };

  // Handle different question types
  switch (question.type) {
    case 'radiogroup':
    case 'checkbox':
    case 'dropdown':
    case 'tagbox':
      if (question.choices && Array.isArray(question.choices)) {
        parsed.choices = question.choices.map((choice: any) => ({
          value: typeof choice === 'string' ? choice : choice.value || choice,
          text: typeof choice === 'string' ? choice : extractText(choice.text) || extractText(choice) || choice.value || choice,
        }));
      }
      break;

    case 'text':
    case 'comment':
      parsed.placeholder = extractText(question.placeholder);
      if (question.inputType) {
        parsed.inputType = question.inputType;
      }
      if (question.type === 'comment') {
        parsed.rows = question.rows || 4;
      }
      break;

    case 'rating':
      parsed.rateMin = question.rateMin || 1;
      parsed.rateMax = question.rateMax || 5;
      parsed.rateStep = question.rateStep || 1;
      parsed.minRateDescription = extractText(question.minRateDescription);
      parsed.maxRateDescription = extractText(question.maxRateDescription);
      break;

    case 'boolean':
      parsed.labelTrue = extractText(question.labelTrue) || 'Yes';
      parsed.labelFalse = extractText(question.labelFalse) || 'No';
      break;

    case 'matrix':
      // For matrix questions, we'll handle rows and columns
      if (question.columns && Array.isArray(question.columns)) {
        parsed.choices = question.columns.map((col: any) => ({
          value: col.value,
          text: extractText(col.text) || col.value,
        }));
      }
      if (question.rows && Array.isArray(question.rows)) {
        parsed.matrixRows = question.rows.map((row: any) => ({
          value: row.value,
          text: extractText(row.text) || row.value,
        }));
      }
      break;

    case 'nouislider':
      parsed.min = question.min;
      parsed.max = question.max;
      parsed.step = question.step;
      break;
  }

  return parsed;
}

function parseSurveyJson(surveyJson: any): ParsedPage[] {
  const pages: ParsedPage[] = [];

  if (!surveyJson || typeof surveyJson !== 'object') {
    throw new Error('Invalid survey JSON provided');
  }

  // Helper function to expand elements including panels and matrix questions
  const expandElements = (elements: any[]): ParsedQuestion[] => {
    const expandedQuestions: ParsedQuestion[] = [];

    elements.forEach(element => {
      if (element.type === 'html') {
        // Skip HTML elements
        return;
      } else if (element.type === 'panel' && element.elements) {
        // Expand panel elements
        expandedQuestions.push(...expandElements(element.elements));
      } else if (element.type === 'matrix') {
        // Expand matrix questions - each row becomes a separate question
        const matrixQuestion = parseQuestion(element);
        if (matrixQuestion.matrixRows) {
          matrixQuestion.matrixRows.forEach(row => {
            const rowQuestion: ParsedQuestion = {
              ...matrixQuestion,
              name: String(row.value),
              title: row.text,
              type: 'matrix-row',
              matrixRows: undefined, // Clear matrix rows for individual questions
            };
            expandedQuestions.push(rowQuestion);
          });
        } else {
          // Fallback if no rows
          expandedQuestions.push(matrixQuestion);
        }
      } else {
        // Regular question
        expandedQuestions.push(parseQuestion(element));
      }
    });

    return expandedQuestions;
  };

  // Handle single page surveys
  if (surveyJson.elements && Array.isArray(surveyJson.elements)) {
    const singlePage: ParsedPage = {
      name: 'page1',
      title: surveyJson.title || 'Survey',
      description: surveyJson.description,
      questions: expandElements(surveyJson.elements),
    };
    pages.push(singlePage);
  }
  // Handle multi-page surveys
  else if (surveyJson.pages && Array.isArray(surveyJson.pages)) {
    surveyJson.pages.forEach((page: any) => {
      const parsedPage: ParsedPage = {
        name: page.name || `page${pages.length + 1}`,
        title: page.title,
        description: page.description,
        questions: [],
      };

      if (page.elements && Array.isArray(page.elements)) {
        parsedPage.questions = expandElements(page.elements);
      }

      pages.push(parsedPage);
    });
  }

  return pages;
}

function addTextToPdf(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  options: {
    fontSize?: number;
    fontStyle?: string;
    maxWidth?: number;
    align?: 'left' | 'center' | 'right';
  } = {}
): number {
  const { fontSize = 10, fontStyle = 'normal', maxWidth = 170, align = 'left' } = options;
  
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', fontStyle);

  if (maxWidth) {
    const lines = pdf.splitTextToSize(text, maxWidth);
    lines.forEach((line: string, index: number) => {
      const lineY = y + (index * fontSize * 0.4);
      if (align === 'center') {
        pdf.text(line, x, lineY, { align: 'center' });
      } else if (align === 'right') {
        pdf.text(line, x, lineY, { align: 'right' });
      } else {
        pdf.text(line, x, lineY);
      }
    });
    return y + (lines.length * fontSize * 0.4);
  } else {
    pdf.text(text, x, y);
    return y + (fontSize * 0.4);
  }
}

// Helper function to draw a checkbox
function drawCheckbox(pdf: jsPDF, x: number, y: number, size = 3): void {
  pdf.setDrawColor(0); // Black border
  pdf.setFillColor(255, 255, 255); // White fill
  pdf.rect(x, y - size, size, size, 'FD'); // Draw filled rectangle with border
}

// Helper function to draw a radio button (circle)
function drawRadioButton(pdf: jsPDF, x: number, y: number, radius = 1.5): void {
  pdf.setDrawColor(0); // Black border
  pdf.setFillColor(255, 255, 255); // White fill
  pdf.circle(x + radius, y - radius/2, radius, 'FD'); // Draw filled circle with border
}

function addQuestionToPdf(
  pdf: jsPDF,
  question: ParsedQuestion,
  x: number,
  y: number,
  questionNumber: number,
  options: SurveyPdfOptions
): number {
  let currentY = y;
  const margin = options.margin || 20;
  const fontSize = options.fontSize || 10;
  const pageHeight = pdf.internal.pageSize.height;

  // Check if we need a new page
  if (currentY > pageHeight - 40) {
    pdf.addPage();
    currentY = margin;
  }

  // Question title
  const questionTitle = options.includeQuestionNumbers 
    ? `${questionNumber}. ${question.title}`
    : question.title;
  
  currentY = addTextToPdf(pdf, questionTitle, x, currentY, {
    fontSize: fontSize + 2,
    fontStyle: 'bold',
    maxWidth: 170,
  });

  currentY += 2;

  // Question description
  if (options.showDescriptions && question.description) {
    currentY = addTextToPdf(pdf, question.description, x, currentY, {
      fontSize: fontSize - 1,
      fontStyle: 'italic',
      maxWidth: 170,
    });
    currentY += 2;
  }

  // Required indicator
  if (question.required) {
    currentY = addTextToPdf(pdf, '* Required', x, currentY, {
      fontSize: fontSize - 1,
      fontStyle: 'normal',
      maxWidth: 170,
    });
    currentY += 2;
  }

  // Question-specific content
  switch (question.type) {
    case 'radiogroup':
    case 'dropdown':
      if (options.showChoices && question.choices) {
        question.choices.forEach((choice, index) => {
          if (question.type === 'radiogroup') {
            drawRadioButton(pdf, x + 5, currentY, 1.5);
            pdf.setFontSize(fontSize);
            pdf.text(choice.text, x + 12, currentY);
          } else {
            // For dropdown, just show numbered list
            currentY = addTextToPdf(pdf, `  ${index + 1}. ${choice.text}`, x + 5, currentY, {
              fontSize: fontSize,
              maxWidth: 165,
            });
          }
          currentY += 6;
        });
      }
      break;

    case 'checkbox':
      if (options.showChoices && question.choices) {
        question.choices.forEach((choice) => {
          drawCheckbox(pdf, x + 5, currentY, 3);
          pdf.setFontSize(fontSize);
          pdf.text(choice.text, x + 12, currentY);
          currentY += 6;
        });
      }
      break;

    case 'text':
      if (question.inputType === 'range') {
        // This is a numberline/slider question
        const min = question.min || 0;
        const max = question.max || 10;
        
        // Add instruction text
        currentY = addTextToPdf(pdf, 'Please mark your position on the line below:', x + 5, currentY, {
          fontSize: fontSize - 1,
          fontStyle: 'italic',
          maxWidth: 165,
        });
        currentY += 5;
        
        // Draw the numberline
        currentY = drawNumberline(pdf, x + 5, currentY, 120, min, max);
        currentY += 5;
      } else {
        const inputTypeText = question.inputType ? ` (${question.inputType})` : '';
        currentY = addTextToPdf(pdf, `  ________________${inputTypeText}`, x + 5, currentY, {
          fontSize: fontSize,
          maxWidth: 165,
        });
      }
      break;

    case 'comment':
      const rows = question.rows || 4;
      for (let i = 0; i < rows; i++) {
        currentY = addTextToPdf(pdf, '  ________________________________________________', x + 5, currentY, {
          fontSize: fontSize,
          maxWidth: 165,
        });
        currentY += 1;
      }
      break;

    case 'rating':
      const ratingText = `  Rating: ${question.rateMin || 1} to ${question.rateMax || 5}`;
      currentY = addTextToPdf(pdf, ratingText, x + 5, currentY, {
        fontSize: fontSize,
        maxWidth: 165,
      });
      if (question.minRateDescription || question.maxRateDescription) {
        const descriptions = `  (${question.minRateDescription || ''} ... ${question.maxRateDescription || ''})`;
        currentY = addTextToPdf(pdf, descriptions, x + 5, currentY + 1, {
          fontSize: fontSize - 1,
          fontStyle: 'italic',
          maxWidth: 165,
        });
      }
      break;

    case 'boolean':
      const trueLabel = question.labelTrue || 'Yes';
      const falseLabel = question.labelFalse || 'No';
      
      // Draw first checkbox and label
      drawCheckbox(pdf, x + 5, currentY, 3);
      pdf.setFontSize(fontSize);
      pdf.text(trueLabel, x + 12, currentY);
      
      // Draw second checkbox and label (offset horizontally)
      const trueLabelWidth = pdf.getTextWidth(trueLabel);
      const checkboxSpacing = Math.max(30, trueLabelWidth + 20);
      drawCheckbox(pdf, x + 5 + checkboxSpacing, currentY, 3);
      pdf.text(falseLabel, x + 12 + checkboxSpacing, currentY);
      
      currentY += 8;
      break;

    case 'matrix':
      // Full matrix question (if not expanded into rows)
      if (options.showChoices && question.choices) {
        currentY = addTextToPdf(pdf, '  Matrix Question - Please refer to original survey for full layout', x + 5, currentY, {
          fontSize: fontSize - 1,
          fontStyle: 'italic',
          maxWidth: 165,
        });
      }
      break;

    case 'matrix-row':
      // Individual matrix row question
      if (options.showChoices && question.choices) {
        // Show as radio buttons with the matrix column choices
        question.choices.forEach((choice) => {
          drawRadioButton(pdf, x + 5, currentY, 1.5);
          pdf.setFontSize(fontSize);
          pdf.text(choice.text, x + 12, currentY);
          currentY += 6;
        });
      } else {
        currentY = addTextToPdf(pdf, '  ________________', x + 5, currentY, {
          fontSize: fontSize,
          maxWidth: 165,
        });
      }
      break;

    default:
      currentY = addTextToPdf(pdf, '  ________________', x + 5, currentY, {
        fontSize: fontSize,
        maxWidth: 165,
      });
      break;
  }

  return currentY + 5; // Add some space after each question
}

/**
 * Generate a PDF from SurveyJS JSON
 * @param surveyJson - The SurveyJS JSON object
 * @param options - PDF generation options
 * @returns Promise<GeneratePdfResult>
 */
export async function generateSurveyPdf(
  surveyJson: any,
  options: Partial<SurveyPdfOptions> = {}
): Promise<GeneratePdfResult> {
  try {
    const mergedOptions = { ...defaultOptions, ...options };
    const pages = parseSurveyJson(surveyJson);
    
    if (pages.length === 0) {
      throw new Error('No pages found in survey JSON');
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const margin = mergedOptions.margin || 20;
    let currentY = margin;
    let questionCounter = 1;

    // Add logo to first page
    const logoUrl = mergedOptions.logoUrl || '/public/LEVANTE/Levante_Logo.png';
    if (logoUrl) {
      try {
        await addLogoToPdf(pdf, margin, 5, logoUrl);
        currentY = margin + 5; // Extra space for logo
      } catch (error) {
        console.warn('Could not add logo, continuing without it:', error);
      }
    }

    // Add title
    if (mergedOptions.title || surveyJson.title) {
      const title = mergedOptions.title || surveyJson.title;
      currentY = addTextToPdf(pdf, title, 105, currentY, {
        fontSize: 16,
        fontStyle: 'bold',
        align: 'center',
      });
      currentY += 10;
    }

    // Add fill-in-the-blank fields for caregiver information
    currentY = addTextToPdf(pdf, "Child's Name: ________________________________", margin, currentY, {
      fontSize: 10,
      maxWidth: 170,
    });
    currentY += 5;
    
    currentY = addTextToPdf(pdf, "Caregiver's Name: ________________________________", margin, currentY, {
      fontSize: 10,
      maxWidth: 170,
    });
    currentY += 5;
    
    currentY = addTextToPdf(pdf, "Site and/or School: ________________________________", margin, currentY, {
      fontSize: 10,
      maxWidth: 170,
    });
    currentY += 5;
    
    currentY = addTextToPdf(pdf, "Date Completed: ________________________________", margin, currentY, {
      fontSize: 10,
      maxWidth: 170,
    });
    currentY += 10;

    // Process each page
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      if (!page) continue;
      
      // Add page title (if multiple pages)
      if (mergedOptions.includePages && pages.length > 1 && page.title) {
        if (pageIndex > 0) {
          pdf.addPage();
          if (logoUrl) {
            try {
              await addLogoToPdf(pdf, margin, 5, logoUrl);
              currentY = margin + 5; // Extra space for logo
            } catch (error) {
              console.warn('Could not add logo to new page:', error);
              currentY = margin;
            }
          } else {
            currentY = margin;
          }
        }
        
        currentY = addTextToPdf(pdf, page.title, margin, currentY, {
          fontSize: 14,
          fontStyle: 'bold',
          maxWidth: 170,
        });
        currentY += 5;
      }

      // Add page description
      if (page.description) {
        currentY = addTextToPdf(pdf, page.description, margin, currentY, {
          fontSize: 10,
          fontStyle: 'italic',
          maxWidth: 170,
        });
        currentY += 5;
      }

      // Add questions
      for (let questionIndex = 0; questionIndex < page.questions.length; questionIndex++) {
        const question = page.questions[questionIndex];
        if (!question) continue;
        
        currentY = addQuestionToPdf(
          pdf,
          question,
          margin,
          currentY,
          questionCounter,
          mergedOptions
        );
        questionCounter++;
      }
    }

    // Add footer with page numbers
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      const pageHeight = pdf.internal.pageSize.height;
      const pageWidth = pdf.internal.pageSize.width;
      const footerText = `Page ${i} out of ${pageCount}`;
      
      // Calculate center position
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const textWidth = pdf.getTextWidth(footerText);
      const x = (pageWidth - textWidth) / 2;
      
      pdf.text(footerText, x, pageHeight - 10);
    }

    const blob = pdf.output('blob');
    const filename = `survey-${surveyJson.title || 'form'}-${new Date().toISOString().split('T')[0]}.pdf`;

    return {
      success: true,
      blob,
      filename,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Load survey JSON from a URL and generate PDF
 * @param url - URL to the survey JSON
 * @param options - PDF generation options
 * @returns Promise<GeneratePdfResult>
 */
export async function generateSurveyPdfFromUrl(
  url: string,
  options: Partial<SurveyPdfOptions> = {}
): Promise<GeneratePdfResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch survey from URL: ${response.statusText}`);
    }
    const surveyJson = await response.json();
    return generateSurveyPdf(surveyJson, options);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch survey JSON';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Download a PDF blob as a file
 * @param blob - The PDF blob
 * @param filename - The filename for download
 */
export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Preview a PDF blob in a new window
 * @param blob - The PDF blob
 */
export function previewPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export { parseSurveyJson }; 