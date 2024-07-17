import { cleanupOutdatedCaches, PrecacheController, precacheAndRoute } from 'workbox-precaching';
import { swrAudioURLs, swrImageUrls, swrLookupTableUrl } from '@/helpers/swrAssetsList.js';

// import { NavigationRoute, registerRoute } from 'workbox-routing';

const dataCacheName = 'roar-offline';
const cacheName = 'roar-offline';

// self.addEventListener('message', (event) => {
//   if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
// });

// to allow work offline
// registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// self.__WB_MANIFEST;
const urlsToCache = [...swrAudioURLs, ...swrImageUrls, ...swrLookupTableUrl];

const filesToCache = [];

const precacheController = new PrecacheController();
precacheController.addToCacheList(urlsToCache);
// only add cache list if prod
if (process.env.NODE_ENV === 'production') {
  precacheAndRoute(self.__WB_MANIFEST);
}

const pagesToPrecaheAndRoute = [
  { url: './index.html', revision: '383676' },
  { url: './src/pages/HomeAdministrator.vue', revision: null },
  { url: './src/pages/HomeParticipant.vue', revision: null },
  { url: './src/pages/PlayApp.vue', revision: null },
];

self.addEventListener('install', (event) => {
  // Passing in event is required in Workbox v6+
  event.waitUntil(precacheController.install(event));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(workbox.core.cacheNames.precache));
  // Passing in event is required in Workbox v6+
  event.waitUntil(precacheController.activate(event));
});

// only enable cache falling back to network if offline is enabled
// TODO: Get user data into the service worker
if (true) {
  // adding cache then network strategy if offline
  self.addEventListener('fetch', (event) => {
    event.respondWith(
      (async function () {
        const response = await caches.match(event.request);
        return response || fetch(event.request);
      })(),
    );
  });
}

cleanupOutdatedCaches();
