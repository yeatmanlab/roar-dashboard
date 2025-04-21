<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
// Using non-type-checked import to bypass TS error
// @ts-ignore
import { useAuthStore } from '@/store/auth';
import { useWindowSize } from '@vueuse/core';

// Get package info
import packageJson from '../../package.json';

// Define user info interface
interface UserInfo {
  displayName: string | null;
  email: string | null;
  uid: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

// Get auth store
const authStore = useAuthStore();

// Get app and core-tasks versions
const appVersion = ref(packageJson.version);
const coreTasksVersion = ref(packageJson.dependencies['@levante-framework/core-tasks'].replace('^', ''));

// User information
const userInfo = ref<UserInfo | null>(null);

// System information
const browserInfo = ref({
  userAgent: '',
  appName: '',
  appVersion: '',
  platform: '',
  vendor: '',
  language: '',
  cookiesEnabled: false
});

const { width, height } = useWindowSize();
const screenResolution = computed(() => `${width.value} x ${height.value}`);

const deviceType = computed(() => {
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      return 'Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
      return 'Mobile';
    }
    return 'Desktop';
  }
  return 'Unknown';
});

const zoomLevel = ref(1);
const connectionInfo = ref({
  effectiveType: '',
  downlink: 0,
  rtt: 0,
  saveData: false
});

const performanceInfo = ref({
  memory: {
    jsHeapSizeLimit: 0,
    totalJSHeapSize: 0,
    usedJSHeapSize: 0
  },
  navigation: {
    type: '',
    redirectCount: 0
  },
  timing: {
    loadTime: 0,
    domContentLoaded: 0
  }
});

// Calculate zoom level
function calculateZoomLevel() {
  const ratio = Math.round((window.outerWidth / window.innerWidth) * 100) / 100;
  zoomLevel.value = ratio;
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    userInfo.value = {
      displayName: authStore.userDisplayName,
      email: authStore.userEmail,
      uid: authStore.userId,
      isAdmin: authStore.isUserAdmin,
      isSuperAdmin: authStore.isUserSuperAdmin
    };
  }

  // Gather browser info
  if (typeof navigator !== 'undefined') {
    browserInfo.value = {
      userAgent: navigator.userAgent,
      appName: navigator.appName,
      appVersion: navigator.appVersion,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled
    };
  }

  // Calculate zoom level
  calculateZoomLevel();
  window.addEventListener('resize', calculateZoomLevel);

  // Get connection info
  // @ts-ignore - Navigator connection API might not be typed correctly
  if (navigator.connection) {
    // @ts-ignore
    const conn = navigator.connection;
    connectionInfo.value = {
      effectiveType: conn.effectiveType || 'unknown',
      downlink: conn.downlink || 0,
      rtt: conn.rtt || 0,
      saveData: conn.saveData || false
    };
  }

  // Performance info
  if (window.performance) {
    const perf = window.performance;
    const navEntry = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    // @ts-ignore - Performance memory API might not be typed
    if (performance.memory) {
      // @ts-ignore
      performanceInfo.value.memory = {
        // @ts-ignore
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024)),
        // @ts-ignore
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
        // @ts-ignore
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
      };
    }

    if (navEntry) {
      performanceInfo.value.timing = {
        loadTime: Math.round(navEntry.loadEventEnd - navEntry.startTime),
        domContentLoaded: Math.round(navEntry.domContentLoadedEventEnd - navEntry.startTime)
      };
    }
  }
});
</script>

<template>
  <div class="debug-page p-4">
    <h1 class="text-3xl font-bold mb-6">Debug Information</h1>

    <div class="card mb-4">
      <div class="card-header bg-blue-50 p-3">
        <h2 class="text-xl font-bold">Application Information</h2>
      </div>
      <div class="card-body p-3">
        <div class="grid">
          <div class="col-4 font-bold">App Version:</div>
          <div class="col-8">{{ appVersion }}</div>

          <div class="col-4 font-bold">Core Tasks Version:</div>
          <div class="col-8">{{ coreTasksVersion }}</div>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header bg-blue-50 p-3">
        <h2 class="text-xl font-bold">Device & Browser Information</h2>
      </div>
      <div class="card-body p-3">
        <div class="grid">
          <div class="col-4 font-bold">Device Type:</div>
          <div class="col-8">{{ deviceType }}</div>

          <div class="col-4 font-bold">Screen Resolution:</div>
          <div class="col-8">{{ screenResolution }} pixels</div>

          <div class="col-4 font-bold">Browser Zoom Level:</div>
          <div class="col-8">{{ Math.round(zoomLevel * 100) }}%</div>

          <div class="col-4 font-bold">Browser:</div>
          <div class="col-8 text-wrap">{{ browserInfo.appName }}</div>

          <div class="col-4 font-bold">Browser Version:</div>
          <div class="col-8 text-wrap">{{ browserInfo.appVersion }}</div>

          <div class="col-4 font-bold">Platform:</div>
          <div class="col-8">{{ browserInfo.platform }}</div>

          <div class="col-4 font-bold">Language:</div>
          <div class="col-8">{{ browserInfo.language }}</div>

          <div class="col-4 font-bold">Cookies Enabled:</div>
          <div class="col-8">{{ browserInfo.cookiesEnabled ? 'Yes' : 'No' }}</div>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header bg-blue-50 p-3">
        <h2 class="text-xl font-bold">Network Information</h2>
      </div>
      <div class="card-body p-3">
        <div class="grid" v-if="connectionInfo.effectiveType">
          <div class="col-4 font-bold">Connection Type:</div>
          <div class="col-8">{{ connectionInfo.effectiveType }}</div>

          <div class="col-4 font-bold">Downlink:</div>
          <div class="col-8">{{ connectionInfo.downlink }} Mbps</div>

          <div class="col-4 font-bold">Round Trip Time:</div>
          <div class="col-8">{{ connectionInfo.rtt }} ms</div>

          <div class="col-4 font-bold">Data Saver:</div>
          <div class="col-8">{{ connectionInfo.saveData ? 'Enabled' : 'Disabled' }}</div>
        </div>
        <div v-else>Network information not available</div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header bg-blue-50 p-3">
        <h2 class="text-xl font-bold">Performance Metrics</h2>
      </div>
      <div class="card-body p-3">
        <div class="grid">
          <template v-if="performanceInfo.memory.totalJSHeapSize > 0">
            <div class="col-4 font-bold">Memory Usage:</div>
            <div class="col-8">{{ performanceInfo.memory.usedJSHeapSize }}MB / {{ performanceInfo.memory.totalJSHeapSize }}MB</div>

            <div class="col-4 font-bold">Memory Limit:</div>
            <div class="col-8">{{ performanceInfo.memory.jsHeapSizeLimit }}MB</div>
          </template>

          <template v-if="performanceInfo.timing.loadTime > 0">
            <div class="col-4 font-bold">Page Load Time:</div>
            <div class="col-8">{{ performanceInfo.timing.loadTime }}ms</div>

            <div class="col-4 font-bold">DOM Content Loaded:</div>
            <div class="col-8">{{ performanceInfo.timing.domContentLoaded }}ms</div>
          </template>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header bg-blue-50 p-3">
        <h2 class="text-xl font-bold">Authentication Status</h2>
      </div>
      <div class="card-body p-3">
        <div v-if="authStore.isAuthenticated">
          <div class="grid">
            <div class="col-4 font-bold">Login Status:</div>
            <div class="col-8">Logged In</div>

            <div class="col-4 font-bold">Display Name:</div>
            <div class="col-8">{{ userInfo?.displayName || 'N/A' }}</div>

            <div class="col-4 font-bold">Email:</div>
            <div class="col-8">{{ userInfo?.email || 'N/A' }}</div>

            <div class="col-4 font-bold">User ID:</div>
            <div class="col-8">{{ userInfo?.uid || 'N/A' }}</div>

            <div class="col-4 font-bold">Admin:</div>
            <div class="col-8">{{ userInfo?.isAdmin ? 'Yes' : 'No' }}</div>

            <div class="col-4 font-bold">Super Admin:</div>
            <div class="col-8">{{ userInfo?.isSuperAdmin ? 'Yes' : 'No' }}</div>
          </div>
        </div>
        <div v-else>
          <p>Not logged in</p>
        </div>
      </div>
    </div>
  </div>
</template> 