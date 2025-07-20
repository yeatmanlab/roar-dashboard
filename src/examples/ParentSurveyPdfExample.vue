<template>
  <div class="survey-pdf-example">
    <Card>
      <template #header>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-file-pdf text-red-500" />
          <h2 class="m-0">Parent Survey PDF Generator</h2>
        </div>
      </template>

      <template #content>
        <div class="flex flex-column gap-4">
          <p>
            This example demonstrates generating a printable PDF from the 
            <code>parent_survey_family.json</code> survey.
          </p>

          <!-- Survey Info -->
          <div v-if="surveyInfo" class="surface-100 border-round p-3">
            <h4 class="mt-0">📋 Survey Information</h4>
            <div class="grid">
              <div class="col-6 md:col-3">
                <strong>Title:</strong><br>
                {{ surveyInfo.title || 'No title' }}
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

          <!-- Progress -->
          <div v-if="isGenerating" class="flex flex-column gap-2">
            <label>Generating PDF...</label>
            <ProgressBar :value="progress" />
          </div>

          <!-- Error Display -->
          <Message v-if="error" severity="error" :closable="false">
            {{ error }}
          </Message>

          <!-- Success Message -->
          <Message v-if="lastGeneratedFile" severity="success" :closable="false">
            ✅ PDF generated successfully: {{ lastGeneratedFile }}
          </Message>

          <!-- Action Buttons -->
          <div class="flex gap-2 flex-wrap">
            <Button
              label="Load Survey Info"
              icon="pi pi-info-circle"
              @click="loadSurveyInfo"
              :disabled="isGenerating"
              severity="secondary"
            />
            
            <Button
              label="Generate Basic PDF"
              icon="pi pi-download"
              @click="generateBasicPdf"
              :disabled="isGenerating"
            />
            
            <Button
              label="Generate Detailed PDF"
              icon="pi pi-file-pdf"
              @click="generateDetailedPdf"
              :disabled="isGenerating"
              severity="info"
            />
            
            <Button
              label="Preview PDF"
              icon="pi pi-eye"
              @click="previewPdf"
              :disabled="isGenerating"
              severity="help"
            />
          </div>

          <!-- Options -->
          <div class="surface-100 border-round p-3">
            <h4 class="mt-0">⚙️ PDF Options</h4>
            <div class="grid">
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-3">
                  <div class="field-checkbox">
                    <Checkbox
                      v-model="pdfOptions.includeQuestionNumbers"
                      inputId="questionNumbers"
                      binary
                    />
                    <label for="questionNumbers" class="ml-2">Include Question Numbers</label>
                  </div>
                  
                  <div class="field-checkbox">
                    <Checkbox
                      v-model="pdfOptions.showChoices"
                      inputId="showChoices"
                      binary
                    />
                    <label for="showChoices" class="ml-2">Show Answer Choices</label>
                  </div>
                </div>
              </div>

              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-3">
                  <div class="flex flex-column gap-2">
                    <label for="fontSize">Font Size ({{ pdfOptions.fontSize }}pt)</label>
                    <Slider
                      v-model="pdfOptions.fontSize"
                      id="fontSize"
                      :min="8"
                      :max="16"
                      :step="1"
                    />
                  </div>
                  
                  <div class="flex flex-column gap-2">
                    <label for="margin">Margin ({{ pdfOptions.margin }}mm)</label>
                    <Slider
                      v-model="pdfOptions.margin"
                      id="margin"
                      :min="10"
                      :max="40"
                      :step="5"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Code Example -->
          <div class="surface-100 border-round p-3">
            <h4 class="mt-0">💻 Code Example</h4>
            <pre class="bg-gray-900 text-white p-3 border-round text-sm overflow-auto"><code>// How to use in your Vue component
import { generateSurveyPdfFromUrl, downloadPdf } from '@/helpers/surveyPdfGenerator';
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';

const result = await generateSurveyPdfFromUrl(
  `${LEVANTE_BUCKET_URL}/parent_survey_family.json`,
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
}</code></pre>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Slider from 'primevue/slider';
import ProgressBar from 'primevue/progressbar';
import Message from 'primevue/message';
import { 
  generateSurveyPdfFromUrl, 
  downloadPdf, 
  previewPdf as previewPdfHelper,
  type SurveyPdfOptions 
} from '@/helpers/surveyPdfGenerator';
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';

const toast = useToast();

// State
const isGenerating = ref(false);
const progress = ref(0);
const error = ref<string | null>(null);
const lastGeneratedFile = ref<string | null>(null);
const surveyInfo = ref<any>(null);

// PDF Options
const pdfOptions = reactive<SurveyPdfOptions>({
  includeQuestionNumbers: true,
  includePages: true,
  fontSize: 10,
  margin: 20,
  showChoices: true,
  showDescriptions: true,
});

// Survey URL
const surveyUrl = `${LEVANTE_BUCKET_URL}/parent_survey_family.json`;

// Methods
const clearStatus = () => {
  error.value = null;
  lastGeneratedFile.value = null;
};

const loadSurveyInfo = async () => {
  clearStatus();
  
  try {
    const response = await fetch(surveyUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch survey: ${response.statusText}`);
    }
    
    const surveyJson = await response.json();
    
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

    if (surveyJson.pages) {
      surveyJson.pages.forEach((page: any) => {
        if (page.elements) countElements(page.elements);
      });
    } else if (surveyJson.elements) {
      countElements(surveyJson.elements);
    }

    surveyInfo.value = {
      title: surveyJson.title || 'Parent Survey - Family',
      pages: surveyJson.pages?.length || 1,
      totalQuestions,
      questionTypes: Array.from(questionTypes)
    };
    
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Survey information loaded successfully',
      life: 3000,
    });
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load survey';
    error.value = errorMessage;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: 5000,
    });
  }
};

const generateBasicPdf = async () => {
  clearStatus();
  isGenerating.value = true;
  progress.value = 0;

  try {
    const result = await generateSurveyPdfFromUrl(surveyUrl, {
      title: 'Parent Survey - Family',
      ...pdfOptions,
      headerText: 'Levante Research Platform - Parent Survey',
      footerText: `Generated on ${new Date().toLocaleDateString()}`
    });

    if (result.success && result.blob && result.filename) {
      downloadPdf(result.blob, result.filename);
      lastGeneratedFile.value = result.filename;
      
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'PDF generated and downloaded successfully',
        life: 3000,
      });
    } else {
      throw new Error(result.error || 'Failed to generate PDF');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
    error.value = errorMessage;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: 5000,
    });
  } finally {
    isGenerating.value = false;
    progress.value = 100;
  }
};

const generateDetailedPdf = async () => {
  clearStatus();
  isGenerating.value = true;
  progress.value = 0;

  try {
    const result = await generateSurveyPdfFromUrl(surveyUrl, {
      title: 'Parent Survey - Family (Detailed Version)',
      ...pdfOptions,
      fontSize: (pdfOptions.fontSize || 10) + 1,
      margin: (pdfOptions.margin || 20) + 5,
      showDescriptions: true,
      headerText: 'Levante Research Platform - Parent Survey (Family)',
      footerText: '© 2024 Levante Research Platform - Confidential'
    });

    if (result.success && result.blob && result.filename) {
      downloadPdf(result.blob, result.filename);
      lastGeneratedFile.value = result.filename;
      
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Detailed PDF generated and downloaded successfully',
        life: 3000,
      });
    } else {
      throw new Error(result.error || 'Failed to generate PDF');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
    error.value = errorMessage;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: 5000,
    });
  } finally {
    isGenerating.value = false;
    progress.value = 100;
  }
};

const previewPdf = async () => {
  clearStatus();
  isGenerating.value = true;

  try {
    const result = await generateSurveyPdfFromUrl(surveyUrl, {
      title: 'Parent Survey - Family (Preview)',
      ...pdfOptions,
      headerText: 'Levante Research Platform - Parent Survey',
      footerText: 'Preview Version'
    });

    if (result.success && result.blob) {
      previewPdfHelper(result.blob);
      
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'PDF opened for preview',
        life: 3000,
      });
    } else {
      throw new Error(result.error || 'Failed to generate PDF');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
    error.value = errorMessage;
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: 5000,
    });
  } finally {
    isGenerating.value = false;
  }
};

// Load survey info on mount
loadSurveyInfo();
</script>

<style scoped>
.survey-pdf-example {
  max-width: 900px;
  margin: 0 auto;
}

.field-checkbox {
  display: flex;
  align-items: center;
}

pre code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
}
</style> 