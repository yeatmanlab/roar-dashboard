import { cleanupOutdatedCaches } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/backoffice/] }));

cleanupOutdatedCaches();
