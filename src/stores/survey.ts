import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SurveyModel } from 'survey-core'
import type { SurveyFileKey } from '@/constants/bucket'

export interface SurveyInfo {
  title: string
  description?: string
  pages: number
  questions: number
  questionTypes: string[]
  lastModified?: Date
}

export const useSurveyStore = defineStore('survey', () => {
  // State
  const surveys = ref<Map<SurveyFileKey, any>>(new Map())
  const currentSurvey = ref<any>(null)
  const currentSurveyKey = ref<SurveyFileKey | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Survey model for SurveyJS
  const surveyModel = ref<SurveyModel | null>(null)
  
  // Survey creator state
  const creatorSurvey = ref<any>(null)
  const isCreatorMode = ref(false)

  // Getters
  const surveyInfo = computed((): SurveyInfo | null => {
    if (!currentSurvey.value) return null
    
    const survey = currentSurvey.value
    let totalQuestions = 0
    const questionTypes = new Set<string>()
    
    // Count questions and collect types
    if (survey.elements) {
      totalQuestions = survey.elements.length
      survey.elements.forEach((element: any) => {
        questionTypes.add(element.type || 'unknown')
      })
    } else if (survey.pages) {
      survey.pages.forEach((page: any) => {
        if (page.elements) {
          totalQuestions += page.elements.length
          page.elements.forEach((element: any) => {
            questionTypes.add(element.type || 'unknown')
          })
        }
      })
    }
    
    return {
      title: survey.title || 'Untitled Survey',
      description: survey.description,
      pages: survey.pages?.length || 1,
      questions: totalQuestions,
      questionTypes: Array.from(questionTypes)
    }
  })

  const surveyList = computed(() => {
    return Array.from(surveys.value.entries()).map(([key, survey]) => ({
      key,
      title: survey?.title || key,
      description: survey?.description || ''
    }))
  })

  // Actions
  const loadSurvey = async (surveyKey: SurveyFileKey) => {
    isLoading.value = true
    error.value = null
    
    try {
      // Check if already loaded
      if (surveys.value.has(surveyKey)) {
        currentSurvey.value = surveys.value.get(surveyKey)
        currentSurveyKey.value = surveyKey
        return
      }
      
      // Load from bucket (this will be implemented by the components)
      throw new Error('Survey loading must be implemented by component')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const setSurvey = (surveyKey: SurveyFileKey, surveyData: any) => {
    surveys.value.set(surveyKey, surveyData)
    currentSurvey.value = surveyData
    currentSurveyKey.value = surveyKey
  }

  const clearCurrentSurvey = () => {
    currentSurvey.value = null
    currentSurveyKey.value = null
    surveyModel.value = null
  }

  const setSurveyModel = (model: SurveyModel) => {
    surveyModel.value = model
  }

  const setCreatorSurvey = (survey: any) => {
    creatorSurvey.value = survey
  }

  const toggleCreatorMode = (enabled: boolean) => {
    isCreatorMode.value = enabled
  }

  const setError = (errorMessage: string) => {
    error.value = errorMessage
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    surveys,
    currentSurvey,
    currentSurveyKey,
    isLoading,
    error,
    surveyModel,
    creatorSurvey,
    isCreatorMode,
    
    // Getters
    surveyInfo,
    surveyList,
    
    // Actions
    loadSurvey,
    setSurvey,
    clearCurrentSurvey,
    setSurveyModel,
    setCreatorSurvey,
    toggleCreatorMode,
    setError,
    clearError
  }
}, {
  persist: {
    storage: sessionStorage,
    paths: ['surveys', 'currentSurveyKey']
  }
}) 