import axios from 'axios'
import { LEVANTE_BUCKET_URL, SURVEY_FILES, type SurveyFileKey, type SurveyFileName } from '@/constants/bucket'

export interface SurveyResponse {
  data: any
  lastModified?: Date
  size?: number
}

/**
 * Load a survey from Google Cloud Storage bucket
 */
export async function loadSurveyFromBucket(surveyKey: SurveyFileKey): Promise<SurveyResponse> {
  try {
    const fileName = SURVEY_FILES[surveyKey]
    const url = `${LEVANTE_BUCKET_URL}/${fileName}`
    
    console.log(`📋 Loading survey: ${surveyKey} from ${url}`)
    
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.data) {
      throw new Error('Empty survey data received')
    }
    
    // Validate survey structure
    if (typeof response.data !== 'object') {
      throw new Error('Invalid survey format: expected JSON object')
    }
    
    console.log(`✅ Survey loaded: ${response.data.title || 'Untitled'}`)
    
    return {
      data: response.data,
      lastModified: response.headers['last-modified'] 
        ? new Date(response.headers['last-modified']) 
        : undefined,
      size: response.headers['content-length'] 
        ? parseInt(response.headers['content-length']) 
        : undefined
    }
  } catch (error) {
    console.error(`❌ Failed to load survey ${surveyKey}:`, error)
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error(`Survey not found: ${surveyKey}`)
      } else if (error.response?.status === 403) {
        throw new Error(`Access denied to survey: ${surveyKey}`)
      } else if (error.code === 'ECONNABORTED') {
        throw new Error(`Timeout loading survey: ${surveyKey}`)
      } else {
        throw new Error(`Network error loading survey: ${error.message}`)
      }
    }
    
    throw error
  }
}

/**
 * Load all available surveys from the bucket
 */
export async function loadAllSurveys(): Promise<Map<SurveyFileKey, any>> {
  const surveys = new Map<SurveyFileKey, any>()
  const errors: string[] = []
  
  console.log('📋 Loading all surveys from bucket...')
  
  const loadPromises = Object.keys(SURVEY_FILES).map(async (key) => {
    try {
      const surveyKey = key as SurveyFileKey
      const response = await loadSurveyFromBucket(surveyKey)
      surveys.set(surveyKey, response.data)
      return { key: surveyKey, success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${key}: ${errorMessage}`)
      return { key: key as SurveyFileKey, success: false, error: errorMessage }
    }
  })
  
  const results = await Promise.allSettled(loadPromises)
  
  console.log(`✅ Loaded ${surveys.size} surveys successfully`)
  if (errors.length > 0) {
    console.warn('⚠️ Some surveys failed to load:', errors)
  }
  
  return surveys
}

/**
 * Check if a survey exists in the bucket without loading it
 */
export async function checkSurveyExists(surveyKey: SurveyFileKey): Promise<boolean> {
  try {
    const fileName = SURVEY_FILES[surveyKey]
    const url = `${LEVANTE_BUCKET_URL}/${fileName}`
    
    const response = await axios.head(url, { timeout: 5000 })
    return response.status === 200
  } catch {
    return false
  }
}

/**
 * Get survey metadata without loading the full content
 */
export async function getSurveyMetadata(surveyKey: SurveyFileKey) {
  try {
    const fileName = SURVEY_FILES[surveyKey]
    const url = `${LEVANTE_BUCKET_URL}/${fileName}`
    
    const response = await axios.head(url, { timeout: 5000 })
    
    return {
      exists: true,
      lastModified: response.headers['last-modified'] 
        ? new Date(response.headers['last-modified']) 
        : undefined,
      size: response.headers['content-length'] 
        ? parseInt(response.headers['content-length']) 
        : undefined,
      contentType: response.headers['content-type']
    }
  } catch {
    return {
      exists: false
    }
  }
}

/**
 * Extract text from multilingual survey objects
 */
export function extractText(textObj: any, preferredLanguage: string = 'en'): string {
  if (!textObj) return ''
  
  if (typeof textObj === 'string') {
    return textObj
  }
  
  if (typeof textObj === 'number') {
    return String(textObj)
  }
  
  if (typeof textObj === 'object' && textObj) {
    // Try preferred language first
    if (textObj[preferredLanguage]) {
      return extractText(textObj[preferredLanguage], preferredLanguage)
    }
    
    // Fallback to English if not already tried
    if (preferredLanguage !== 'en' && textObj.en) {
      return extractText(textObj.en, preferredLanguage)
    }
    
    // Try common text properties
    if (textObj.default) return extractText(textObj.default, preferredLanguage)
    if (textObj.text) return extractText(textObj.text, preferredLanguage)
    if (textObj.value) return extractText(textObj.value, preferredLanguage)
    if (textObj.title) return extractText(textObj.title, preferredLanguage)
    
    // Try other language fallbacks
    if (textObj.es) return extractText(textObj.es, preferredLanguage)
    if (textObj.de) return extractText(textObj.de, preferredLanguage)
    
    // If it's an array, join the elements
    if (Array.isArray(textObj)) {
      return textObj
        .map(item => extractText(item, preferredLanguage))
        .filter(text => text)
        .join(', ')
    }
    
    // Try to get first available value
    const values = Object.values(textObj).filter(val => val && val !== textObj)
    if (values.length > 0) {
      const firstValue = values[0]
      if (typeof firstValue === 'string') return firstValue
      if (typeof firstValue === 'object') return extractText(firstValue, preferredLanguage)
    }
    
    return ''
  }
  
  return String(textObj)
}

/**
 * Parse HTML content to plain text (basic implementation)
 */
export function parseHtmlToText(html: string): string {
  if (!html) return ''
  
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
} 