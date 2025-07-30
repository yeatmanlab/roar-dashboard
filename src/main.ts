import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

// PrimeVue
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

// SurveyJS
import { surveyPlugin } from 'survey-vue3-ui'
import 'survey-core/survey-core.css'
import 'survey-creator-core/survey-creator-core.css'

// App imports
import App from './App.vue'
import router from './router'

// Environment setup for dev
if (import.meta.env.DEV) {
  (window as any).VITE_FIREBASE_PROJECT = 'DEV'
}

const app = createApp(App)

// Pinia store
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)

// Router
app.use(router)

// PrimeVue configuration
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark-mode',
      cssLayer: false
    }
  }
})

app.use(ToastService)
app.use(ConfirmationService)

// SurveyJS
app.use(surveyPlugin)

app.mount('#app')
