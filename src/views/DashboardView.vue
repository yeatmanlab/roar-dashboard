<template>
  <div class="dashboard">
    <div class="container">
      <!-- Header Section -->
      <section class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title">
            <i class="pi pi-chart-bar"></i>
            Survey Management Dashboard
          </h1>
          <p class="hero-description">
            Manage, create, and analyze surveys from the Levante research platform.
            Access surveys from Google Cloud Storage and use the built-in creator to design new ones.
          </p>
          
          <div class="hero-actions">
            <Button 
              @click="$router.push('/surveys')"
              icon="pi pi-list"
              label="Browse Surveys"
              size="large"
            />
            <Button 
              @click="$router.push('/creator')"
              icon="pi pi-plus"
              label="Create New Survey"
              severity="secondary"
              size="large"
            />
          </div>
        </div>
      </section>

      <!-- Stats Cards -->
      <section class="stats-section">
        <h2 class="section-title">Survey Overview</h2>
        
        <div class="stats-grid">
          <Card class="stat-card">
            <template #content>
              <div class="stat-content">
                <div class="stat-icon stat-icon-primary">
                  <i class="pi pi-file-o"></i>
                </div>
                <div class="stat-info">
                  <h3 class="stat-number">{{ surveyStats.total }}</h3>
                  <p class="stat-label">Available Surveys</p>
                </div>
              </div>
            </template>
          </Card>

          <Card class="stat-card">
            <template #content>
              <div class="stat-content">
                <div class="stat-icon stat-icon-success">
                  <i class="pi pi-check-circle"></i>
                </div>
                <div class="stat-info">
                  <h3 class="stat-number">{{ surveyStats.loaded }}</h3>
                  <p class="stat-label">Loaded Successfully</p>
                </div>
              </div>
            </template>
          </Card>

          <Card class="stat-card">
            <template #content>
              <div class="stat-content">
                <div class="stat-icon stat-icon-warning">
                  <i class="pi pi-exclamation-triangle"></i>
                </div>
                <div class="stat-info">
                  <h3 class="stat-number">{{ surveyStats.errors }}</h3>
                  <p class="stat-label">Load Errors</p>
                </div>
              </div>
            </template>
          </Card>

          <Card class="stat-card">
            <template #content>
              <div class="stat-content">
                <div class="stat-icon stat-icon-info">
                  <i class="pi pi-globe"></i>
                </div>
                <div class="stat-info">
                  <h3 class="stat-number">3</h3>
                  <p class="stat-label">Languages Supported</p>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </section>

      <!-- Recent Surveys -->
      <section class="recent-section">
        <div class="section-header">
          <h2 class="section-title">Available Surveys</h2>
          <Button 
            @click="loadAllSurveys"
            :loading="isLoading"
            icon="pi pi-refresh"
            label="Refresh"
            text
          />
        </div>

        <div v-if="isLoading" class="loading-container">
          <ProgressSpinner />
          <p>Loading surveys from Google Cloud Storage...</p>
        </div>

        <div v-else-if="error" class="error-container">
          <Message :closable="false" severity="error">
            <p><strong>Error loading surveys:</strong> {{ error }}</p>
            <Button 
              @click="loadAllSurveys" 
              label="Retry" 
              size="small" 
              text 
            />
          </Message>
        </div>

        <div v-else class="surveys-grid">
          <Card 
            v-for="survey in availableSurveys" 
            :key="survey.key"
            class="survey-card"
            @click="viewSurvey(survey.key)"
          >
            <template #header>
              <div class="survey-header">
                <i class="pi pi-file-text survey-icon"></i>
                <span class="survey-type">{{ formatSurveyType(survey.key) }}</span>
              </div>
            </template>
            
            <template #title>
              {{ survey.title }}
            </template>
            
            <template #subtitle>
              {{ survey.description || 'No description available' }}
            </template>
            
            <template #content>
              <div class="survey-meta">
                <div class="meta-item">
                  <i class="pi pi-file"></i>
                  <span>{{ survey.key }}</span>
                </div>
              </div>
            </template>
            
            <template #footer>
              <div class="survey-actions">
                <Button 
                  @click.stop="viewSurvey(survey.key)"
                  icon="pi pi-eye"
                  label="View"
                  size="small"
                />
                <Button 
                  @click.stop="previewSurvey(survey.key)"
                  icon="pi pi-play"
                  label="Preview"
                  size="small"
                  text
                />
              </div>
            </template>
          </Card>
        </div>

        <div v-if="!isLoading && availableSurveys.length === 0" class="empty-state">
          <div class="empty-content">
            <i class="pi pi-inbox empty-icon"></i>
            <h3>No Surveys Found</h3>
            <p>No surveys could be loaded from the bucket. Check your connection and try again.</p>
            <Button 
              @click="loadAllSurveys" 
              icon="pi pi-refresh" 
              label="Retry Loading" 
            />
          </div>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="actions-section">
        <h2 class="section-title">Quick Actions</h2>
        
        <div class="actions-grid">
          <Card class="action-card" @click="$router.push('/creator')">
            <template #content>
              <div class="action-content">
                <i class="pi pi-plus action-icon"></i>
                <h3>Create New Survey</h3>
                <p>Use the visual survey builder to create a new survey from scratch</p>
              </div>
            </template>
          </Card>

          <Card class="action-card" @click="$router.push('/surveys')">
            <template #content>
              <div class="action-content">
                <i class="pi pi-search action-icon"></i>
                <h3>Browse All Surveys</h3>
                <p>View and manage all available surveys from the cloud storage</p>
              </div>
            </template>
          </Card>

          <Card class="action-card" @click="openBucketLink">
            <template #content>
              <div class="action-content">
                <i class="pi pi-cloud action-icon"></i>
                <h3>Open Cloud Storage</h3>
                <p>Access the Google Cloud Storage bucket directly</p>
              </div>
            </template>
          </Card>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useSurveyStore } from '@/stores/survey'
import { loadAllSurveys as loadSurveysFromBucket } from '@/helpers/surveyLoader'
import { LEVANTE_BUCKET_URL, SURVEY_FILES } from '@/constants/bucket'
import type { SurveyFileKey } from '@/constants/bucket'

const router = useRouter()
const surveyStore = useSurveyStore()

// Reactive state
const isLoading = ref(false)
const error = ref<string | null>(null)

// Computed properties
const availableSurveys = computed(() => surveyStore.surveyList)

const surveyStats = computed(() => ({
  total: Object.keys(SURVEY_FILES).length,
  loaded: surveyStore.surveys.size,
  errors: Object.keys(SURVEY_FILES).length - surveyStore.surveys.size,
}))

// Methods
const loadAllSurveys = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    const surveys = await loadSurveysFromBucket()
    
    // Update store with loaded surveys
    for (const [key, data] of surveys.entries()) {
      surveyStore.setSurvey(key, data)
    }
    
    console.log(`✅ Loaded ${surveys.size} surveys successfully`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load surveys'
    console.error('❌ Error loading surveys:', err)
  } finally {
    isLoading.value = false
  }
}

const viewSurvey = (surveyKey: SurveyFileKey) => {
  router.push(`/surveys/${surveyKey}`)
}

const previewSurvey = (surveyKey: SurveyFileKey) => {
  router.push(`/surveys/${surveyKey}/preview`)
}

const formatSurveyType = (surveyKey: SurveyFileKey): string => {
  const typeMap: Record<SurveyFileKey, string> = {
    PARENT_FAMILY: 'Family Survey',
    PARENT_CHILD: 'Child Survey', 
    CHILD: 'Student Survey',
    TEACHER_GENERAL: 'Teacher General',
    TEACHER_CLASSROOM: 'Teacher Classroom'
  }
  return typeMap[surveyKey] || surveyKey
}

const openBucketLink = () => {
  const url = LEVANTE_BUCKET_URL.replace('https://storage.googleapis.com/', 'https://console.cloud.google.com/storage/browser/')
  window.open(url, '_blank')
}

// Lifecycle
onMounted(() => {
  // Load surveys if not already loaded
  if (surveyStore.surveys.size === 0) {
    loadAllSurveys()
  }
})
</script>

<style scoped>
.dashboard {
  min-height: calc(100vh - 80px);
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* Hero Section */
.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-content {
  background: white;
  padding: 3rem 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.hero-description {
  font-size: 1.1rem;
  color: #6c757d;
  max-width: 600px;
  margin: 0 auto 2rem;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Stats Section */
.stats-section {
  margin-bottom: 3rem;
}

.section-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 1.5rem;
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: white;
}

.stat-icon-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon-success { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.stat-icon-warning { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
.stat-icon-info { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); }

.stat-info {
  flex: 1;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 0.25rem 0;
}

.stat-label {
  font-size: 0.9rem;
  color: #6c757d;
  margin: 0;
}

/* Recent Surveys Section */
.recent-section {
  margin-bottom: 3rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.loading-container,
.error-container {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.surveys-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.survey-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  height: 100%;
}

.survey-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.survey-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.survey-icon {
  font-size: 1.25rem;
}

.survey-type {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.survey-meta {
  margin-top: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6c757d;
  font-size: 0.875rem;
}

.survey-actions {
  display: flex;
  gap: 0.5rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.empty-content {
  max-width: 400px;
  margin: 0 auto;
}

.empty-icon {
  font-size: 4rem;
  color: #dee2e6;
  margin-bottom: 1rem;
}

.empty-content h3 {
  color: #495057;
  margin-bottom: 0.5rem;
}

.empty-content p {
  color: #6c757d;
  margin-bottom: 1.5rem;
}

/* Actions Section */
.actions-section {
  margin-bottom: 3rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.action-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-align: center;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.action-content {
  padding: 2rem 1rem;
}

.action-icon {
  font-size: 2.5rem;
  color: #667eea;
  margin-bottom: 1rem;
}

.action-content h3 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.action-content p {
  color: #6c757d;
  margin: 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .surveys-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style> 