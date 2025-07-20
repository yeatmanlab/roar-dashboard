// Usage examples for the SurveyJS PDF Generator utility

import { 
  generateSurveyPdf, 
  generateSurveyPdfFromUrl, 
  downloadPdf, 
  previewPdf,
  type SurveyPdfOptions 
} from '@/helpers/surveyPdfGenerator';

// Example 1: Generate PDF from a survey JSON object
export async function exampleGenerateFromJson() {
  const sampleSurvey = {
    title: "Research Survey",
    description: "A sample survey for educational research",
    pages: [
      {
        name: "demographics",
        title: "Demographics",
        elements: [
          {
            type: "text",
            name: "participantId",
            title: "Participant ID",
            isRequired: true,
            placeholder: "Enter your participant ID"
          },
          {
            type: "radiogroup",
            name: "ageGroup",
            title: "Age Group",
            choices: [
              { value: "18-25", text: "18-25 years" },
              { value: "26-35", text: "26-35 years" },
              { value: "36-45", text: "36-45 years" },
              { value: "46+", text: "46+ years" }
            ],
            isRequired: true
          },
          {
            type: "checkbox",
            name: "interests",
            title: "Areas of Interest (select all that apply)",
            choices: [
              "Technology",
              "Education",
              "Healthcare",
              "Research",
              "Arts & Culture"
            ]
          }
        ]
      },
      {
        name: "feedback",
        title: "Feedback",
        elements: [
          {
            type: "rating",
            name: "satisfaction",
            title: "Overall satisfaction with the research platform",
            rateMin: 1,
            rateMax: 10,
            rateStep: 1,
            minRateDescription: "Very Dissatisfied",
            maxRateDescription: "Very Satisfied"
          },
          {
            type: "comment",
            name: "suggestions",
            title: "Additional suggestions or comments",
            description: "Please provide any feedback that could help us improve",
            rows: 4
          }
        ]
      }
    ]
  };

  const options: SurveyPdfOptions = {
    title: "Research Survey - Printable Version",
    includeQuestionNumbers: true,
    includePages: true,
    fontSize: 11,
    margin: 25,
    showChoices: true,
    showDescriptions: true,
    headerText: "Levante Research Platform - Survey Form",
    footerText: "© 2024 Levante Research Platform - Confidential"
  };

  try {
    const result = await generateSurveyPdf(sampleSurvey, options);
    
    if (result.success && result.blob && result.filename) {
      // Download the PDF
      downloadPdf(result.blob, result.filename);
      console.log('PDF generated and downloaded successfully');
      return result;
    } else {
      console.error('Failed to generate PDF:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

// Example 2: Generate PDF from a URL (using existing survey URLs from your project)
export async function exampleGenerateFromUrl() {
  // Replace with actual URLs from your LEVANTE_BUCKET_URL
  const surveyUrl = `${process.env.VITE_LEVANTE_BUCKET_URL || ''}/child_survey.json`;
  
  const options: SurveyPdfOptions = {
    title: "Child Assessment Survey",
    includeQuestionNumbers: true,
    includePages: true,
    fontSize: 10,
    margin: 20,
    showChoices: true,
    showDescriptions: true,
    headerText: "Levante Research Platform - Child Assessment",
    footerText: "Confidential - For Research Use Only"
  };

  try {
    const result = await generateSurveyPdfFromUrl(surveyUrl, options);
    
    if (result.success && result.blob && result.filename) {
      // Preview the PDF in a new window
      previewPdf(result.blob);
      console.log('PDF generated and opened for preview');
      return result;
    } else {
      console.error('Failed to generate PDF from URL:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error generating PDF from URL:', error);
    throw error;
  }
}

// Example 3: Simple integration with Vue component
export function useInVueComponent() {
  // This is how you would use it in a Vue component:
  /*
  <script setup lang="ts">
  import { ref } from 'vue';
  import { generateSurveyPdf, downloadPdf } from '@/helpers/surveyPdfGenerator';

  const isGenerating = ref(false);
  const surveyData = ref({
    title: "My Survey",
    elements: [
      {
        type: "text",
        name: "name",
        title: "Your Name",
        isRequired: true
      }
    ]
  });

  const generatePdf = async () => {
    isGenerating.value = true;
    
    try {
      const result = await generateSurveyPdf(surveyData.value, {
        title: "Custom Survey PDF",
        includeQuestionNumbers: true
      });
      
      if (result.success && result.blob && result.filename) {
        downloadPdf(result.blob, result.filename);
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      isGenerating.value = false;
    }
  };
  </script>

  <template>
    <div>
      <Button 
        @click="generatePdf" 
        :disabled="isGenerating"
        label="Generate PDF"
      />
    </div>
  </template>
  */
}

// Example 4: Batch processing multiple surveys
export async function exampleBatchProcess() {
  const surveyUrls = [
    'child_survey.json',
    'teacher_survey_general.json',
    'parent_survey_family.json'
  ];

  const baseUrl = process.env.VITE_LEVANTE_BUCKET_URL || '';
  
  for (const surveyFile of surveyUrls) {
    try {
      console.log(`Processing ${surveyFile}...`);
      
      const result = await generateSurveyPdfFromUrl(`${baseUrl}/${surveyFile}`, {
        title: `Survey: ${surveyFile.replace('.json', '').replace(/_/g, ' ')}`,
        includeQuestionNumbers: true,
        fontSize: 10,
        margin: 20
      });
      
      if (result.success && result.blob && result.filename) {
        downloadPdf(result.blob, result.filename);
        console.log(`✅ Generated PDF for ${surveyFile}`);
      } else {
        console.error(`❌ Failed to generate PDF for ${surveyFile}:`, result.error);
      }
      
      // Add a small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing ${surveyFile}:`, error);
    }
  }
}

// Example 5: Integrating with existing survey helpers
export async function exampleIntegrateWithExistingSurvey() {
  // This shows how to integrate with your existing survey helpers
  // Import your existing survey helpers if needed
  // import { fetchSurveyData } from '@/helpers/survey';
  
  /*
  try {
    // Use your existing survey loading logic
    const surveyJson = await fetchSurveyData('some-survey-id');
    
    // Generate PDF with custom options
    const result = await generateSurveyPdf(surveyJson, {
      title: surveyJson.title || 'Survey Form',
      includeQuestionNumbers: true,
      includePages: true,
      showChoices: true,
      headerText: 'Levante Research Platform',
      footerText: `Generated on ${new Date().toLocaleDateString()}`
    });
    
    if (result.success && result.blob && result.filename) {
      downloadPdf(result.blob, result.filename);
    }
  } catch (error) {
    console.error('Integration example failed:', error);
  }
  */
}

// Export all examples for easy testing
export const surveyPdfExamples = {
  generateFromJson: exampleGenerateFromJson,
  generateFromUrl: exampleGenerateFromUrl,
  batchProcess: exampleBatchProcess,
  integrateWithExisting: exampleIntegrateWithExistingSurvey
}; 