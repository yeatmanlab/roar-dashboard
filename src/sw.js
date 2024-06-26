import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

cleanupOutdatedCaches();

precacheAndRoute([{ url: '/index.html', revision: '383676' }]);
