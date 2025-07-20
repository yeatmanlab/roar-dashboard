<template>
  <div class="test-survey-pdf">
    <div class="container">
      <h1>🔧 Parent Survey PDF Generator Test</h1>
      
      <Card>
        <template #content>
          <div class="flex flex-column gap-4">
            <p>This will fetch the <code>parent_survey_family.json</code> from the Levante bucket and generate a PDF.</p>
            
            <div class="flex gap-2 flex-wrap">
              <Button
                label="📊 Analyze Survey"
                @click="analyzeSurvey"
                :disabled="isLoading"
              />
              <Button
                label="📄 Generate PDF"
                @click="generatePDF"
                :disabled="isLoading || !surveyData"
                id="generateBtn"
              />
              <Button
                label="⚙️ Generate PDF (Custom Options)"
                @click="generatePDFWithOptions"
                :disabled="isLoading || !surveyData"
                severity="secondary"
              />
            </div>

            <!-- Status -->
            <div v-if="status" :class="['status', statusType]">
              {{ status }}
            </div>

            <!-- Survey Info -->
            <div v-if="surveyInfo" class="surface-100 border-round p-3">
              <h3>📋 Survey Analysis</h3>
              <div class="grid">
                <div class="col-6 md:col-3">
                  <strong>Title:</strong><br>
                  {{ surveyInfo.title }}
                </div>
                <div class="col-6 md:col-3">
                  <strong>Pages:</strong><br>
                  {{ surveyInfo.pages }}
                </div>
                <div class="col-6 md:col-3">
                  <strong>Questions:</strong><br>
                  {{ surveyInfo.totalQuestions }}
                </div>
                <div class="col-6 md:col-3">
                  <strong>Types:</strong><br>
                  {{ surveyInfo.questionTypes.join(', ') }}
                </div>
              </div>
            </div>

            <!-- Code Example -->
            <div class="surface-100 border-round p-3">
              <h4 class="mt-0">💻 Code Example</h4>
              <pre class="code-block">{{ codeExample }}</pre>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Button from 'primevue/button';
import { generateSurveyPdfFromUrl, downloadPdf, previewPdf } from '@/helpers/surveyPdfGenerator';
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';

const toast = useToast();

// State
const isLoading = ref(false);
const status = ref<string>('');
const statusType = ref<string>('info');
const surveyData = ref<any>(null);
const surveyInfo = ref<any>(null);

// Survey URL
const SURVEY_URL = `${LEVANTE_BUCKET_URL}/parent_survey_family.json`;

// Code example
const codeExample = computed(() => `// How to use in your Vue component
import { generateSurveyPdfFromUrl, downloadPdf } from '@/helpers/surveyPdfGenerator';
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';

const result = await generateSurveyPdfFromUrl(
  \`\${LEVANTE_BUCKET_URL}/parent_survey_family.json\`,
  {
    title: 'Parent Survey - Family',
    includeQuestionNumbers: true,
    showChoices: true,
    headerText: 'Levante Research Platform',
    footerText: 'Confidential'
  }
);

if (result.success && result.blob && result.filename) {
  downloadPdf(result.blob, result.filename);
}`);

// Methods
const showStatus = (message: string, type = 'info') => {
  status.value = message;
  statusType.value = type;
};

const analyzeSurvey = async () => {
  showStatus('🔄 Fetching survey data...', 'info');
  isLoading.value = true;
  
  try {
    const response = await fetch(SURVEY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    
    surveyData.value = await response.json();
    
    // Analyze the survey
    let totalQuestions = 0;
    const questionTypes = new Set<string>();
    
    const countElements = (elements: any[]) => {
      elements.forEach(element => {
        if (element.type === 'panel' && element.elements) {
          countElements(element.elements);
        } else if (element.type !== 'html') {
          totalQuestions++;
          questionTypes.add(element.type);
        }
      });
    };

    if (surveyData.value.pages) {
      surveyData.value.pages.forEach((page: any) => {
        if (page.elements) countElements(page.elements);
      });
    } else if (surveyData.value.elements) {
      countElements(surveyData.value.elements);
    }

    surveyInfo.value = {
      title: surveyData.value.title || 'Parent Survey - Family',
      pages: surveyData.value.pages?.length || 1,
      totalQuestions,
      questionTypes: Array.from(questionTypes)
    };
    
    showStatus('✅ Survey data loaded successfully!', 'success');
    
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Survey information loaded successfully',
      life: 3000,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load survey';
    showStatus(`❌ Error loading survey: ${errorMessage}`, 'error');
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
};

const generatePDF = async () => {
  if (!surveyData.value) {
    await analyzeSurvey();
    if (!surveyData.value) return;
  }

  showStatus('🔄 Generating PDF...', 'info');
  isLoading.value = true;

  try {
    const result = await generateSurveyPdfFromUrl(SURVEY_URL, {
      title: 'Parent Survey - Family',
      includeQuestionNumbers: true,
      includePages: true,
      showChoices: true,
      headerText: 'Levante Research Platform - Parent Survey',
      footerText: 'Generated on ' + new Date().toLocaleDateString()
    });

    if (result.success && result.blob && result.filename) {
      downloadPdf(result.blob, result.filename);
      showStatus('✅ PDF generated and downloaded successfully!', 'success');
      
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'PDF generated and downloaded successfully',
        life: 3000,
      });
    } else {
      throw new Error(result.error || 'Failed to generate PDF');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    showStatus(`❌ Error generating PDF: ${errorMessage}`, 'error');
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
};

const generatePDFWithOptions = async () => {
  if (!surveyData.value) {
    await analyzeSurvey();
    if (!surveyData.value) return;
  }

  showStatus('🔄 Generating PDF with custom options...', 'info');
  isLoading.value = true;

  try {
    const result = await generateSurveyPdfFromUrl(SURVEY_URL, {
      title: 'Parent Survey - Family (Detailed Version)',
      includeQuestionNumbers: true,
      includePages: true,
      fontSize: 11,
      margin: 25,
      showChoices: true,
      showDescriptions: true,
      headerText: 'Levante Research Platform - Parent Survey (Family)',
      footerText: '© 2024 Levante Research Platform - Confidential'
    });

    if (result.success && result.blob && result.filename) {
      downloadPdf(result.blob, result.filename);
      showStatus('✅ Detailed PDF generated and downloaded successfully!', 'success');
      
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Detailed PDF generated and downloaded successfully',
        life: 3000,
      });
    } else {
      throw new Error(result.error || 'Failed to generate PDF');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    showStatus(`❌ Error generating PDF: ${errorMessage}`, 'error');
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
};

// Initialize
showStatus('👋 Ready to test! Click "Analyze Survey" to start.', 'info');
</script>

<style scoped>
.test-survey-pdf {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.container {
  width: 100%;
}

.status {
  padding: 12px;
  border-radius: 6px;
  border: 1px solid;
}

.status.success {
  background: #d4edda;
  color: #155724;
  border-color: #c3e6cb;
}

.status.error {
  background: #f8d7da;
  color: #721c24;
  border-color: #f5c6cb;
}

.status.info {
  background: #d1ecf1;
  color: #0c5460;
  border-color: #bee5eb;
}

.code-block {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
}
</style> 