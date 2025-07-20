import { ref, readonly } from 'vue';
import { jsPDF } from 'jspdf';
import type { SurveyModel } from 'survey-core';
import { Model } from 'survey-core';

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
}

interface ParsedPage {
  name: string;
  title?: string;
  description?: string;
  questions: ParsedQuestion[];
}

export function useSurveyPdfGenerator() {
  const isGenerating = ref(false);
  const progress = ref(0);
  const error = ref<string | null>(null);

  const defaultOptions: SurveyPdfOptions = {
    includeQuestionNumbers: true,
    includePages: true,
    fontSize: 10,
    margin: 20,
    showChoices: true,
    showDescriptions: true,
  };

  const parseQuestion = (question: any): ParsedQuestion => {
    const parsed: ParsedQuestion = {
      name: question.name || '',
      title: question.title || question.name || '',
      type: question.type || 'text',
      description: question.description,
      required: question.isRequired || false,
    };

    // Handle different question types
    switch (question.type) {
      case 'radiogroup':
      case 'checkbox':
      case 'dropdown':
      case 'tagbox':
        if (question.choices && Array.isArray(question.choices)) {
          parsed.choices = question.choices.map((choice: any) => ({
            value: typeof choice === 'string' ? choice : choice.value,
            text: typeof choice === 'string' ? choice : choice.text || choice.value,
          }));
        }
        break;

      case 'text':
      case 'comment':
        parsed.placeholder = question.placeholder;
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
        parsed.minRateDescription = question.minRateDescription;
        parsed.maxRateDescription = question.maxRateDescription;
        break;

      case 'nouislider':
      case 'boolean':
        parsed.min = question.min;
        parsed.max = question.max;
        parsed.step = question.step;
        break;
    }

    return parsed;
  };

  const parseSurveyJson = (surveyJson: any): ParsedPage[] => {
    const pages: ParsedPage[] = [];

    if (!surveyJson || typeof surveyJson !== 'object') {
      throw new Error('Invalid survey JSON provided');
    }

    // Handle single page surveys
    if (surveyJson.elements && Array.isArray(surveyJson.elements)) {
      const singlePage: ParsedPage = {
        name: 'page1',
        title: surveyJson.title || 'Survey',
        description: surveyJson.description,
        questions: surveyJson.elements.map(parseQuestion),
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
          parsedPage.questions = page.elements.map(parseQuestion);
        }

        pages.push(parsedPage);
      });
    }

    return pages;
  };

  const addTextToPdf = (
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
  ): number => {
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
  };

  const addQuestionToPdf = (
    pdf: jsPDF,
    question: ParsedQuestion,
    x: number,
    y: number,
    questionNumber: number,
    options: SurveyPdfOptions
  ): number => {
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
            const prefix = question.type === 'radiogroup' ? '○' : `${index + 1}.`;
            currentY = addTextToPdf(pdf, `  ${prefix} ${choice.text}`, x + 5, currentY, {
              fontSize: fontSize,
              maxWidth: 165,
            });
            currentY += 1;
          });
        }
        break;

      case 'checkbox':
        if (options.showChoices && question.choices) {
          question.choices.forEach((choice) => {
            currentY = addTextToPdf(pdf, `  ☐ ${choice.text}`, x + 5, currentY, {
              fontSize: fontSize,
              maxWidth: 165,
            });
            currentY += 1;
          });
        }
        break;

      case 'text':
        const inputTypeText = question.inputType ? ` (${question.inputType})` : '';
        currentY = addTextToPdf(pdf, `  ________________${inputTypeText}`, x + 5, currentY, {
          fontSize: fontSize,
          maxWidth: 165,
        });
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
        currentY = addTextToPdf(pdf, '  ☐ Yes    ☐ No', x + 5, currentY, {
          fontSize: fontSize,
          maxWidth: 165,
        });
        break;

      default:
        currentY = addTextToPdf(pdf, '  ________________', x + 5, currentY, {
          fontSize: fontSize,
          maxWidth: 165,
        });
        break;
    }

    return currentY + 5; // Add some space after each question
  };

  const generatePdfFromJson = async (
    surveyJson: any,
    options: Partial<SurveyPdfOptions> = {}
  ): Promise<GeneratePdfResult> => {
    try {
      isGenerating.value = true;
      error.value = null;
      progress.value = 0;

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

      progress.value = 10;

      // Process each page
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        if (!page) continue;
        
        // Add page title (if multiple pages)
        if (mergedOptions.includePages && pages.length > 1 && page.title) {
          if (pageIndex > 0) {
            pdf.addPage();
            currentY = margin;
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

          // Update progress
          const totalQuestions = pages.reduce((sum, p) => sum + p.questions.length, 0);
          const processedQuestions = questionCounter - 1;
          progress.value = 10 + (processedQuestions / totalQuestions) * 80;
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

      progress.value = 100;

      const blob = pdf.output('blob');
      const filename = `survey-${surveyJson.title || 'form'}-${new Date().toISOString().split('T')[0]}.pdf`;

      return {
        success: true,
        blob,
        filename,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = errorMessage;
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      isGenerating.value = false;
    }
  };

  const generatePdfFromUrl = async (
    url: string,
    options: Partial<SurveyPdfOptions> = {}
  ): Promise<GeneratePdfResult> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch survey from URL: ${response.statusText}`);
      }
      const surveyJson = await response.json();
      return generatePdfFromJson(surveyJson, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch survey JSON';
      error.value = errorMessage;
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const downloadPdf = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const previewPdf = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Note: URL will be revoked when the window is closed
  };

  return {
    // State
    isGenerating: readonly(isGenerating),
    progress: readonly(progress),
    error: readonly(error),

    // Methods
    generatePdfFromJson,
    generatePdfFromUrl,
    downloadPdf,
    previewPdf,
    parseSurveyJson,
  };
}

export default useSurveyPdfGenerator; 