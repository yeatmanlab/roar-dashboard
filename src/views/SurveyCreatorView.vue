<template>
  <div class="survey-creator">
    <div class="creator-header">
      <div class="container">
        <div class="header-content">
          <h1 class="creator-title">
            <i class="pi pi-plus"></i>
            {{ isEditMode ? 'Edit Survey' : 'Create New Survey' }}
          </h1>
          <p class="creator-description">
            {{ isEditMode 
              ? `Editing: ${currentSurveyTitle}` 
              : 'Use the visual survey builder to create a new survey' 
            }}
          </p>
        </div>
        
        <div class="header-actions">
          <Button 
            @click="saveSurvey"
            :loading="isSaving"
            icon="pi pi-save"
            label="Save Survey"
            severity="success"
          />
          <Button 
            @click="previewSurvey"
            icon="pi pi-eye"
            label="Preview"
            outlined
          />
          <Button 
            @click="$router.push('/')"
            icon="pi pi-times"
            label="Cancel"
            text
          />
        </div>
      </div>
    </div>

    <div class="creator-content">
      <div 
        ref="creatorContainer" 
        class="survey-creator-container"
      ></div>
    </div>

    <!-- Preview Dialog -->
    <Dialog 
      v-model:visible="showPreview" 
      header="Survey Preview"
      modal
      :style="{ width: '90vw', height: '80vh' }"
      maximizable
    >
      <div 
        ref="previewContainer" 
        class="survey-preview-container"
      ></div>
    </Dialog>

    <!-- Save Dialog -->
    <Dialog 
      v-model:visible="showSaveDialog" 
      header="Save Survey"
      modal
      :style="{ width: '50rem' }"
    >
      <div class="save-form">
        <div class="field">
          <label for="surveyTitle">Survey Title</label>
          <InputText 
            id="surveyTitle"
            v-model="saveForm.title" 
            placeholder="Enter survey title"
            class="w-full"
          />
        </div>
        
        <div class="field">
          <label for="surveyDescription">Description</label>
          <Textarea 
            id="surveyDescription"
            v-model="saveForm.description" 
            placeholder="Enter survey description"
            rows="3"
            class="w-full"
          />
        </div>
        
        <div class="field">
          <label for="surveyKey">Survey Key</label>
          <InputText 
            id="surveyKey"
            v-model="saveForm.key" 
            placeholder="survey_key_name"
            class="w-full"
          />
          <small>This will be used as the filename (without .json extension)</small>
        </div>
      </div>
      
      <template #footer>
        <Button 
          @click="showSaveDialog = false" 
          label="Cancel" 
          text 
        />
        <Button 
          @click="handleSave" 
          :loading="isSaving"
          label="Save to Cloud" 
          icon="pi pi-cloud-upload"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { SurveyCreator } from 'survey-creator-core'
import { SurveyComponent } from 'survey-vue3-ui'
import { Model } from 'survey-core'
import { useSurveyStore } from '@/stores/survey'
import { loadSurveyFromBucket } from '@/helpers/surveyLoader'
import type { SurveyFileKey } from '@/constants/bucket'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const surveyStore = useSurveyStore()

// Refs
const creatorContainer = ref<HTMLElement>()
const previewContainer = ref<HTMLElement>()

// State
const creator = ref<SurveyCreator | null>(null)
const previewModel = ref<Model | null>(null)
const showPreview = ref(false)
const showSaveDialog = ref(false)
const isSaving = ref(false)

const saveForm = ref({
  title: '',
  description: '',
  key: ''
})

// Computed
const isEditMode = computed(() => !!route.params.surveyKey)
const currentSurveyKey = computed(() => route.params.surveyKey as SurveyFileKey)
const currentSurveyTitle = computed(() => {
  if (!isEditMode.value) return ''
  return surveyStore.currentSurvey?.title || currentSurveyKey.value
})

// Methods
const initializeCreator = () => {
  if (!creatorContainer.value) return

  const options = {
    showLogicTab: true,
    showTranslationTab: true,
    showEmbeddedSurveyTab: false,
    showJSONEditorTab: true,
    showTestSurveyTab: true,
    showElementToolbox: true,
    showPropertyGrid: true
  }

  creator.value = new SurveyCreator(options)
  
  // Set up event handlers
  creator.value.saveSurveyFunc = (no: number, callback: (no: number, isSuccess: boolean) => void) => {
    // Auto-save functionality could go here
    callback(no, true)
  }

  // Load existing survey if in edit mode
  if (isEditMode.value && surveyStore.currentSurvey) {
    creator.value.text = JSON.stringify(surveyStore.currentSurvey, null, 2)
    saveForm.value.title = surveyStore.currentSurvey.title || ''
    saveForm.value.description = surveyStore.currentSurvey.description || ''
    saveForm.value.key = currentSurveyKey.value
  } else {
    // Start with a basic survey template
    creator.value.text = JSON.stringify({
      title: "New Survey",
      description: "Created with Levante Survey Manager",
      pages: [{
        name: "page1",
        elements: [{
          type: "text",
          name: "question1",
          title: "What is your name?",
          isRequired: true
        }]
      }]
    }, null, 2)
  }

  // Render creator
  creator.value.render(creatorContainer.value)
}

const loadExistingSurvey = async () => {
  if (!isEditMode.value) return

  try {
    const surveyKey = currentSurveyKey.value
    
    // Load from store if available, otherwise fetch from bucket
    if (!surveyStore.surveys.has(surveyKey)) {
      const response = await loadSurveyFromBucket(surveyKey)
      surveyStore.setSurvey(surveyKey, response.data)
    }
    
    console.log(`✅ Loaded survey for editing: ${surveyKey}`)
  } catch (error) {
    console.error('❌ Error loading survey for editing:', error)
    toast.add({
      severity: 'error',
      summary: 'Load Error',
      detail: `Failed to load survey: ${error instanceof Error ? error.message : 'Unknown error'}`,
      life: 5000
    })
    router.push('/')
  }
}

const saveSurvey = () => {
  if (!creator.value) return
  
  try {
    const surveyJSON = JSON.parse(creator.value.text)
    
    // Pre-fill form with current survey data
    saveForm.value.title = surveyJSON.title || 'Untitled Survey'
    saveForm.value.description = surveyJSON.description || ''
    saveForm.value.key = isEditMode.value ? currentSurveyKey.value : ''
    
    showSaveDialog.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Invalid JSON',
      detail: 'The survey JSON is invalid. Please check the JSON editor tab.',
      life: 5000
    })
  }
}

const handleSave = async () => {
  if (!creator.value) return
  
  isSaving.value = true
  
  try {
    const surveyJSON = JSON.parse(creator.value.text)
    
    // Update survey metadata
    surveyJSON.title = saveForm.value.title
    surveyJSON.description = saveForm.value.description
    
    // Here you would implement the actual save to GCS
    // For now, we'll just save to the store
    const surveyKey = saveForm.value.key as SurveyFileKey
    surveyStore.setSurvey(surveyKey, surveyJSON)
    
    toast.add({
      severity: 'success',
      summary: 'Survey Saved',
      detail: `Survey "${saveForm.value.title}" has been saved successfully.`,
      life: 3000
    })
    
    showSaveDialog.value = false
    
    // Navigate to survey detail view
    router.push(`/surveys/${surveyKey}`)
    
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Save Error',
      detail: `Failed to save survey: ${error instanceof Error ? error.message : 'Unknown error'}`,
      life: 5000
    })
  } finally {
    isSaving.value = false
  }
}

const previewSurvey = () => {
  if (!creator.value) return
  
  try {
    const surveyJSON = JSON.parse(creator.value.text)
    previewModel.value = new Model(surveyJSON)
    showPreview.value = true
    
    // Render preview after dialog opens
    setTimeout(() => {
      if (previewContainer.value && previewModel.value) {
        previewModel.value.render(previewContainer.value)
      }
    }, 100)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Preview Error',
      detail: 'Invalid survey JSON. Cannot generate preview.',
      life: 3000
    })
  }
}

// Lifecycle
onMounted(async () => {
  if (isEditMode.value) {
    await loadExistingSurvey()
  }
  
  // Initialize creator after potential survey loading
  setTimeout(() => {
    initializeCreator()
  }, 100)
})

onBeforeUnmount(() => {
  if (creator.value) {
    creator.value.dispose()
  }
  if (previewModel.value) {
    previewModel.value.dispose()
  }
})
</script>

<style scoped>
.survey-creator {
  min-height: 100vh;
  background: #f8f9fa;
}

.creator-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.creator-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.creator-description {
  font-size: 1rem;
  margin: 0.5rem 0 0 0;
  opacity: 0.9;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.creator-content {
  padding: 0;
}

.survey-creator-container {
  min-height: calc(100vh - 200px);
}

.survey-preview-container {
  min-height: 60vh;
}

.save-form .field {
  margin-bottom: 1.5rem;
}

.save-form label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.save-form small {
  display: block;
  margin-top: 0.25rem;
  color: #6c757d;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .creator-title {
    font-size: 1.5rem;
  }
  
  .header-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>

<style>
/* Global SurveyJS Creator styles */
.sv-creator-tab-container {
  border-radius: 0 !important;
}

.svc-creator {
  border: none !important;
  box-shadow: none !important;
}

.svc-creator__area {
  background: white !important;
}
</style> 