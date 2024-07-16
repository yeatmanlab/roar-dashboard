import { cleanupOutdatedCaches, PrecacheController, precacheAndRoute } from 'workbox-precaching';
import { swrAudioURLs, swrImageUrls, swrLookupTableUrl } from '@/helpers/swrAssetsList.js';

// import { NavigationRoute, registerRoute } from 'workbox-routing';

self.__WB_MANIFEST;

// self.addEventListener('message', (event) => {
//   if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
// });

// to allow work offline
// registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// self.__WB_MANIFEST;
const urlsToCache = [...swrAudioURLs, ...swrImageUrls, ...swrLookupTableUrl];

const precacheController = new PrecacheController();
precacheController.addToCacheList(urlsToCache);
// only add cache list if prod
if (process.env.NODE_ENV === 'production') {
  precacheController.addToCacheList(self.__WB_MANIFEST);
}

precacheController.addToCacheList([
  {
    url: '/index.html',
    revision: null,
  },
]);

precacheAndRoute([{ url: '/index.html', revision: '383676' }], {
  directoryIndex: null,
});

self.addEventListener('install', (event) => {
  // Passing in event is required in Workbox v6+
  event.waitUntil(precacheController.install(event));
});

self.addEventListener('activate', (event) => {
  // Passing in event is required in Workbox v6+
  event.waitUntil(precacheController.activate(event));
});

// self.addEventListener('fetch', (event) => {
//   const cacheKey = precacheController.getCacheKeyForURL(event.request.url);
//   //   event.respondWith(caches.match(cacheKey).then(...));
//   event.respondWith(caches.match(cacheKey));
// });

cleanupOutdatedCaches();
