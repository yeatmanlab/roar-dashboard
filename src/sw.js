import { cleanupOutdatedCaches, PrecacheController } from 'workbox-precaching';
import { swrAudioURLs, swrImageUrls, swrLookupTableUrl } from '@/helpers/swrAssetsList.js';

self.__WB_MANIFEST;
const urlsToCache = [...swrAudioURLs, ...swrImageUrls, ...swrLookupTableUrl];

const precacheController = new PrecacheController();
precacheController.addToCacheList(urlsToCache);

precacheController.addToCacheList([
  {
    url: '/index.html',
    revision: null,
  },
]);

self.addEventListener('install', (event) => {
  // Passing in event is required in Workbox v6+
  event.waitUntil(precacheController.install(event));
});

self.addEventListener('activate', (event) => {
  // Passing in event is required in Workbox v6+
  event.waitUntil(precacheController.activate(event));
});

self.addEventListener('fetch', (event) => {
  const cacheKey = precacheController.getCacheKeyForURL(event.request.url);
  //   event.respondWith(caches.match(cacheKey).then(...));
  event.respondWith(caches.match(cacheKey));
});

cleanupOutdatedCaches();
