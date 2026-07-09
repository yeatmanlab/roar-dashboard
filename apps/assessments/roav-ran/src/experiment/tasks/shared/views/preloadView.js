/**
 * @fileoverview module to support preloadView.js
 * @module preloadView
 */

import loadingScreen_page from './loadingScreen.html';
import i18next from 'i18next';

function extractAudioUrls(obj) {
  if (typeof obj !== 'object' || obj === null) return [];
  const urls = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'audioSrc' && typeof val === 'string') urls.push(val);
    else if (key === 'audioSrcs' && Array.isArray(val)) urls.push(...val);
    else urls.push(...extractAudioUrls(val));
  }
  return urls;
}

/**
 * Displays the preload view and handles asset preloading.
 * @async
 * @function preloadView
 * @param {Config} config - Configuration object for preloading.
 * @param {Object<string, string>} audioMapping - Object containing instructions audio source paths that need to be preloaded.
 * @param {string[]} imageAssets - Array containing image source paths that need to be preloaded.
 * @returns {Promise<void>} A promise that resolves when all assets are preloaded.
 */
export async function preloadView(config, audioMapping, imageAssets) {
  window._preloadedAudioURLs = new Map();
  window._preloadedImageURLs = new Map();
  window._preloadedImages = new Map();

  const loadingHtml = loadingScreen_page;
  const page = document.createElement('div');

  page.innerHTML = loadingHtml;
  document.body.appendChild(page);

  //add loading text
  document.getElementById('loading-text').innerHTML = audioMapping.loading;

  const baseAssets = [
    'tasks/shared/eyetracking_google.onnx',
    'https://cdn.jsdelivr.net/npm/onnxjs/dist/onnx.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh_solution_simd_wasm_bin.wasm',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh_solution_packed_assets.data',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh_solution_simd_wasm_bin.js',
  ];

  const audioAssets = [...new Set(extractAudioUrls(audioMapping))];
  const list = [...new Set([...baseAssets, ...audioAssets, ...imageAssets])];

  // Preload each asset
  await preloadAssets(list, page);

  console.log('All assets preloaded.');
}

/**
 * Preloads a list of assets.
 * @function preloadAssets
 * @param {string[]} assets - An array of asset URLs to preload.
 * @param {HTMLElement} page - The page element to remove after preloading.
 * @returns {Promise<void>} A promise that resolves when all assets are preloaded.
 */
function preloadAssets(assets, page) {
  return new Promise((resolve, reject) => {
    let loadedCount = 0;

    assets.forEach((assetUrl) => {
      const assetType = getAssetType(assetUrl);

      switch (assetType) {
        case 'audio':
          fetch(assetUrl)
            .then((response) => {
              if (!response.ok) {
                onAssetError();
                return;
              }
              return response.blob();
            })
            .then((blob) => {
              if (blob) window._preloadedAudioURLs.set(assetUrl, URL.createObjectURL(blob));
              onAssetLoaded();
            })
            .catch(onAssetError);
          break;

        case 'image':
          fetch(assetUrl)
            .then((response) => {
              if (!response.ok) {
                onAssetError();
                return;
              }
              return response.blob();
            })
            .then((blob) => {
              if (!blob) {
                onAssetError();
                return;
              }
              const objectUrl = URL.createObjectURL(blob);
              window._preloadedImageURLs.set(assetUrl, objectUrl);
              const img = new Image();
              img.src = objectUrl;
              const decodePromise = img.decode ? img.decode() : Promise.resolve();
              return decodePromise.then(() => {
                window._preloadedImages.set(assetUrl, img);
                onAssetLoaded();
              });
            })
            .catch(onAssetError);
          break;

        case 'fetch':
          fetch(assetUrl)
            .then((response) => {
              if (response.ok) onAssetLoaded();
              else onAssetError();
            })
            .catch(onAssetError);
          break;

        default:
          console.error('Unknown asset type:', assetUrl);
          onAssetError();
      }

      function onAssetLoaded() {
        loadedCount++;
        if (loadedCount == assets.length) {
          page.remove(); // Remove the page
          resolve(); // All assets loaded
        }
      }

      function onAssetError(err) {
        console.error('Error loading asset:', assetUrl, err);
        reject(err); // Reject if any asset fails to load
      }
    });
  });
}

/**
 * Determines the type of asset based on its URL.
 * @function getAssetType
 * @param {string} url - The URL of the asset.
 * @returns {string} The type of the asset (currently always returns "fetch").
 */
function getAssetType(url) {
  if (url.match(/\.mp3(\?|$)/i)) return 'audio';
  if (url.match(/\.(png|jpe?g|svg|webp|gif|bmp|ico)(\?|$)/i)) return 'image';
  return 'fetch';
}
