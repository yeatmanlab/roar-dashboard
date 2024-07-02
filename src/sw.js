// import { cleanupOutdatedCaches, PrecacheController, precacheAndRoute } from 'workbox-precaching';
// import { swrAudioURLs, swrImageUrls swrLookupTableUrl } from '@/helpers/swrAssetsList.js';
// import { useRegisterSW } from 'virtual:pwa-register/vue'

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

export let self;

// console.log(message)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// self.__WB_MANIFEST is default injection point
precacheAndRoute(self.__WB_MANIFEST);

// clean old assets
cleanupOutdatedCaches();

// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// const intervalMS = 60 * 60 * 1000

// const updateServiceWorker = useRegisterSW({
//   onRegistered(r) {
//     r && setInterval(() => {
//       r.update()
//     }, intervalMS)
//   }
// })

// self.__WB_MANIFEST;
// const urlsToCache = [...swrAudioURLs, ...swrImageUrls, ...swrLookupTableUrl];

// const precacheController = new PrecacheController();
// precacheController.addToCacheList(urlsToCache);

// precacheController.addToCacheList([
//   {
//     url: '/index.html',
//     revision: null,
//   },
// ]);
// console.log('wbmanifest', self.__WB_MANIFEST)
// precacheAndRoute(self.__WB_MANIFEST ?? [])

// precacheAndRoute(
//   [
//     {url: '/index.html', revision: '383676'},
//   ],
//   {
//     directoryIndex: null,
//   }
// );

// self.addEventListener('install', (event) => {
//   // Passing in event is required in Workbox v6+
//   event.waitUntil(precacheController.install(event));
// });

// self.addEventListener('activate', (event) => {
//   // Passing in event is required in Workbox v6+
//   event.waitUntil(precacheController.activate(event));
// });

// self.addEventListener('fetch', (event) => {
//   const cacheKey = precacheController.getCacheKeyForURL(event.request.url);
//   //   event.respondWith(caches.match(cacheKey).then(...));
//   event.respondWith(caches.match(cacheKey));
// });

// cleanupOutdatedCaches();
