import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();

console.log('sw self', self);
precacheAndRoute(self.__WB_MANIFEST || []);
