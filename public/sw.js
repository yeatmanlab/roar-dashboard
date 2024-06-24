// importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.3/workbox-sw.js');
import workbox from 'workbox-sw';
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);
