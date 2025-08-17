// Test script to generate PDF from parent_survey_family.json
// This is a Node.js script to test the PDF generation

import fetch from 'node-fetch';
import fs from 'fs';

// Mock the browser environment for jsPDF
global.window = {};
global.document = {
  createElement: () => ({
    appendChild: () => {},
    click: () => {},
    style: {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

// Simple test function
async function testParentSurveyPdf() {
  try {
    // The survey URL from the dev bucket
    const surveyUrl = 'https://storage.googleapis.com/levante-assets-dev/surveys/parent_survey_family.json';
    
    console.log('🔄 Fetching survey from:', surveyUrl);
    
    const response = await fetch(surveyUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch survey: ${response.statusText}`);
    }
    
    const surveyJson = await response.json();
    console.log('✅ Survey loaded successfully');
    console.log('📊 Survey title:', surveyJson.title || 'No title');
    console.log('📄 Pages:', surveyJson.pages?.length || 'Single page');
    
    // Count total questions
    let totalQuestions = 0;
    if (surveyJson.elements) {
      totalQuestions = surveyJson.elements.length;
    } else if (surveyJson.pages) {
      totalQuestions = surveyJson.pages.reduce((sum, page) => {
        return sum + (page.elements?.length || 0);
      }, 0);
    }
    console.log('❓ Total questions:', totalQuestions);
    
    // Show question types
    const questionTypes = new Set();
    const collectQuestionTypes = (elements) => {
      if (elements) {
        elements.forEach(element => {
          questionTypes.add(element.type || 'unknown');
        });
      }
    };
    
    if (surveyJson.elements) {
      collectQuestionTypes(surveyJson.elements);
    } else if (surveyJson.pages) {
      surveyJson.pages.forEach(page => {
        collectQuestionTypes(page.elements);
      });
    }
    
    console.log('🔧 Question types found:', Array.from(questionTypes).join(', '));
    
    // Save the survey JSON for inspection
    fs.writeFileSync('parent_survey_family_sample.json', JSON.stringify(surveyJson, null, 2));
    console.log('💾 Survey JSON saved to parent_survey_family_sample.json');
    
    console.log('\n✨ Survey analysis complete! You can now use this data with the PDF generator.');
    console.log('\n📋 To generate PDF in your Vue app, use:');
    console.log(`
import { generateSurveyPdfFromUrl, downloadPdf } from '@/helpers/surveyPdfGenerator';

const result = await generateSurveyPdfFromUrl('${surveyUrl}', {
  title: '${surveyJson.title || 'Parent Survey - Family'}',
  includeQuestionNumbers: true,
  includePages: true,
  showChoices: true,
  headerText: 'Levante Research Platform - Parent Survey',
  footerText: 'Confidential - For Research Use Only'
});

if (result.success && result.blob && result.filename) {
  downloadPdf(result.blob, result.filename);
}
    `);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testParentSurveyPdf(); 