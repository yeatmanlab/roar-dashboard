<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Button from 'primevue/button';
import { useAuthStore } from '@/store/auth';
import { useWindowSize } from '@vueuse/core';
// Get package info
import packageJson from '../../package.json';
import { logger } from '@/logger'; // Import the logger

// Define user info interface
interface UserInfo {
  displayName: string | null;
  email: string | null;
  uid: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userType: string | null;
}

// Environment information
const envInfo = {
  mode: import.meta.env.MODE,
  baseUrl: import.meta.env.BASE_URL,
  isLevante: import.meta.env.VITE_LEVANTE === 'TRUE',
  firebaseProject: import.meta.env.VITE_FIREBASE_PROJECT || 'Not set',
};

// Get auth store
const authStore = useAuthStore();

// Get app and core-tasks versions
const appVersion = ref(packageJson.version);
const coreTasksVersion = ref(packageJson.dependencies['@levante-framework/core-tasks'].replace('^', ''));
const commitHash = import.meta.env.VITE_APP_VERSION;

// User information - Use computed property
const userInfo = computed<UserInfo | null>(() => {
  if (authStore.isAuthenticated) {
    const { userData } = authStore;
    return {
      displayName: userData?.username || userData?.displayName || null,
      email: authStore?.email || null,
      uid: authStore?.uid || null,
      isAdmin: authStore.isUserAdmin,
      userType: userData?.userType || null,
      isSuperAdmin: authStore.isUserSuperAdmin,
    };
  }
  return null;
});

// System information
const browserInfo = ref({
  userAgent: '',
  appName: '',
  appVersion: '',
  platform: '',
  vendor: '',
  language: '',
  cookiesEnabled: false,
});

const { width, height } = useWindowSize();
const screenResolution = computed(() => `${width.value} x ${height.value}`);

const deviceType = computed(() => {
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      return 'Tablet';
    }
    if (
      /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
        userAgent,
      )
    ) {
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
  saveData: false,
});

const performanceInfo = ref({
  memory: {
    jsHeapSizeLimit: 0,
    totalJSHeapSize: 0,
    usedJSHeapSize: 0,
  },
  navigation: {
    type: '',
    redirectCount: 0,
  },
  timing: {
    loadTime: 0,
    domContentLoaded: 0,
  },
});

// Calculate zoom level
function calculateZoomLevel() {
  const ratio = Math.round((window.outerWidth / window.innerWidth) * 100) / 100;
  zoomLevel.value = ratio;
}

onMounted(() => {
  // Gather browser info
  if (typeof navigator !== 'undefined') {
    browserInfo.value = {
      userAgent: navigator.userAgent,
      appName: navigator.appName,
      appVersion: navigator.appVersion,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
    };
  }

  // Calculate zoom level
  calculateZoomLevel();
  window.addEventListener('resize', calculateZoomLevel);

  // Get connection info
  // @ts-expect-error - Navigator connection API might not be typed correctly
  if (navigator.connection) {
    // @ts-expect-error - Navigator connection properties may not be fully typed
    const conn = navigator.connection;
    connectionInfo.value = {
      effectiveType: conn.effectiveType || 'unknown',
      downlink: conn.downlink || 0,
      rtt: conn.rtt || 0,
      saveData: conn.saveData || false,
    };
  }

  // Performance info
  if (window.performance) {
    const perf = window.performance;
    const navEntry = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    // @ts-expect-error - Performance memory API might not be typed
    if (performance.memory) {
      performanceInfo.value.memory = {
        // @ts-expect-error - Performance memory property access
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024)),
        // @ts-expect-error - Performance memory property access
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
        // @ts-expect-error - Performance memory property access
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)),
      };
    }

    if (navEntry) {
      performanceInfo.value.timing = {
        loadTime: Math.round(navEntry.loadEventEnd - navEntry.startTime),
        domContentLoaded: Math.round(navEntry.domContentLoadedEventEnd - navEntry.startTime),
      };
    }
  }
});

// --- Logger Test Methods ---
function sendTestEvent() {
  logger.capture('test_event_from_debug_vue', undefined, true);
  alert('Test event sent!');
}

function sendTestError() {
  try {
    // Create a new error to ensure it has a stack trace
    throw new Error('Test error from Debug.vue');
  } catch (e) {
    logger.error(e, undefined, true);
    alert('Test error sent!');
  }
}
// -------------------------
</script>

<template>
  <div class="debug-page p-3">
    <h1 class="text-xl font-bold mb-2">Debug Information</h1>

    <div class="grid">
      <!-- Left Column -->
      <div class="col-12 md:col-6 lg:col-4 pr-2">
        <!-- App Info -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">Application</h2>
          </div>
          <div class="card-body p-2">
            <table class="w-full text-sm">
              <tbody>
                <tr>
                  <td class="font-semibold pr-2">App Version:</td>
                  <td>{{ appVersion }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Core Tasks:</td>
                  <td>{{ coreTasksVersion }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Commit Hash:</td>
                  <td>{{ commitHash }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Device Info -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">Device & Display</h2>
          </div>
          <div class="card-body p-2">
            <table class="w-full text-sm">
              <tbody>
                <tr>
                  <td class="font-semibold pr-2">Device Type:</td>
                  <td>{{ deviceType }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Resolution:</td>
                  <td>{{ screenResolution }} px</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Zoom Level:</td>
                  <td>{{ Math.round(zoomLevel * 100) }}%</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Platform:</td>
                  <td>{{ browserInfo.platform }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Browser Info -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">Browser</h2>
          </div>
          <div class="card-body p-2">
            <table class="w-full text-sm">
              <tbody>
                <tr>
                  <td class="font-semibold pr-2">Name:</td>
                  <td class="truncate">{{ browserInfo.appName }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Version:</td>
                  <td class="truncate">{{ browserInfo.appVersion }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Language:</td>
                  <td>{{ browserInfo.language }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Cookies:</td>
                  <td>
                    {{ browserInfo.cookiesEnabled ? 'Enabled' : 'Disabled' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Middle Column -->
      <div class="col-12 md:col-6 lg:col-4 px-1">
        <!-- Network Info -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">Network</h2>
          </div>
          <div class="card-body p-2">
            <table v-if="connectionInfo.effectiveType" class="w-full text-sm">
              <tbody>
                <tr>
                  <td class="font-semibold pr-2">Connection:</td>
                  <td>{{ connectionInfo.effectiveType }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Downlink:</td>
                  <td>{{ connectionInfo.downlink }} Mbps</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">RTT:</td>
                  <td>{{ connectionInfo.rtt }} ms</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Data Saver:</td>
                  <td>{{ connectionInfo.saveData ? 'On' : 'Off' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-sm p-2">Network information not available</p>
          </div>
        </div>

        <!-- Performance -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">Performance</h2>
          </div>
          <div class="card-body p-2">
            <table class="w-full text-sm">
              <tbody>
                <tr v-if="performanceInfo.memory.totalJSHeapSize > 0">
                  <td class="font-semibold pr-2">Memory Usage:</td>
                  <td>
                    {{ performanceInfo.memory.usedJSHeapSize }}MB / {{ performanceInfo.memory.totalJSHeapSize }}MB
                  </td>
                </tr>
                <tr v-if="performanceInfo.memory.jsHeapSizeLimit > 0">
                  <td class="font-semibold pr-2">Memory Limit:</td>
                  <td>{{ performanceInfo.memory.jsHeapSizeLimit }}MB</td>
                </tr>
                <tr v-if="performanceInfo.timing.loadTime > 0">
                  <td class="font-semibold pr-2">Load Time:</td>
                  <td>{{ performanceInfo.timing.loadTime }}ms</td>
                </tr>
                <tr v-if="performanceInfo.timing.domContentLoaded > 0">
                  <td class="font-semibold pr-2">DOM Loaded:</td>
                  <td>{{ performanceInfo.timing.domContentLoaded }}ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- User Agent -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">User Agent</h2>
          </div>
          <div class="card-body p-2">
            <p class="text-xs text-wrap break-all">
              {{ browserInfo.userAgent }}
            </p>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="col-12 md:col-6 lg:col-4 pl-2">
        <!-- Auth Status -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">Authentication Status</h2>
          </div>
          <div class="card-body p-2">
            <table v-if="authStore.isAuthenticated" class="w-full text-sm">
              <tbody>
                <tr>
                  <td class="font-semibold pr-2">Status:</td>
                  <td>Logged In</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Name:</td>
                  <td>{{ userInfo?.displayName || 'N/A' }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Email:</td>
                  <td>{{ userInfo?.email || 'N/A' }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">User ID:</td>
                  <td class="truncate">{{ userInfo?.uid || 'N/A' }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Admin:</td>
                  <td>{{ userInfo?.isAdmin ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Super Admin:</td>
                  <td>{{ userInfo?.isSuperAdmin ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">User Type:</td>
                  <td>{{ userInfo?.userType || 'N/A' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-sm p-2">Not logged in</p>
          </div>
        </div>

        <!-- Environment -->
        <div class="card mb-2 shadow-1">
          <div class="card-header bg-blue-50 py-1 px-2">
            <h2 class="text-sm font-bold">Environment</h2>
          </div>
          <div class="card-body p-2">
            <table class="w-full text-sm">
              <tbody>
                <tr>
                  <td class="font-semibold pr-2">Mode:</td>
                  <td>{{ envInfo.mode }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Base URL:</td>
                  <td>{{ envInfo.baseUrl }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Levante:</td>
                  <td>{{ envInfo.isLevante ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <td class="font-semibold pr-2">Firebase Project:</td>
                  <td>{{ envInfo.firebaseProject }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Logger Test Buttons -->
    <div class="card mt-3 shadow-1">
      <div class="card-header bg-yellow-50 py-1 px-2">
        <h2 class="text-sm font-bold">Logger Tests</h2>
      </div>
      <div class="card-body p-2 flex gap-2">
        <Button label="Send Test Event (Force)" severity="info" @click="sendTestEvent" />
        <Button label="Send Test Error (Force)" severity="danger" @click="sendTestError" />
      </div>
    </div>
    <!-- End Logger Test Buttons -->
  </div>
</template>

<style scoped>
.card {
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.card-header {
  border-bottom: 1px solid #e2e8f0;
}

tr:not(:last-child) td {
  border-bottom: 1px solid #f0f4f8;
  padding: 4px 0;
}

tr:last-child td {
  padding: 4px 0;
}

table {
  border-spacing: 0;
}

.shadow-1 {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.debug-page {
  max-width: 1200px;
  margin: auto;
}

.card {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.card-header {
  border-bottom: 1px solid #e0e0e0;
}

table td {
  padding: 2px 0;
  vertical-align: top;
}
</style>
