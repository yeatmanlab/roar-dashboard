import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { swrAudioURLs, swrImageUrls, swrLookupTableUrl } from '@/helpers/swrAssetsList.js';

const urlsToCache = [...swrAudioURLs, ...swrImageUrls, ...swrLookupTableUrl];

console.log('urlstocache', urlsToCache);

precacheAndRoute(urlsToCache);

cleanupOutdatedCaches();
self.__WB_MANIFEST;
