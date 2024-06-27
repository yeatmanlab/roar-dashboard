import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
console.log('service worker disable before', self.__WB_DISABLE_DEV_LOGS);
self.__WB_DISABLE_DEV_LOGS = true;
console.log('service worker disable after', self.__WB_DISABLE_DEV_LOGS);
cleanupOutdatedCaches();

precacheAndRoute([{ url: '/index.html', revision: '383676' }]);
// precacheAndRoute(self.__WB_MANIFEST);
