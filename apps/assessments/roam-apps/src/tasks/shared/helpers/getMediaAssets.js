import { getDevice } from '@bdelab/roar-utils';
// Grab by device, check nested shared

// How to use whitelist: The key is the parent folder, the value is the actual (child) folder to whitelist
// This is because we need to know the folder in which to whitelist
// The value is an array of strings (folder names)

// TODO:
// 1. Add search device folder after language code folder
// 2. Whitelisting

export async function getMediaAssets(
  bucketName,
  whitelist = {},
  language,
  nextPageToken = '',
  categorizedObjects = { images: {}, audio: {}, video: {} },
) {
  const device = getDevice();

  const baseUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o`;
  let url = baseUrl;
  if (nextPageToken) {
    url += `?pageToken=${nextPageToken}`;
  }

  const response = await fetch(url);
  const data = await response.json();

  data.items.forEach((item) => {
    if (isLanguageAndDeviceValid(item.name, language, device) && isWhitelisted(item.name, whitelist)) {
      const contentType = item.contentType;
      const id = item.name;
      const path = `https://storage.googleapis.com/${bucketName}/${id}`;
      const fileName = id.split('/').pop().split('.')[0];
      const camelCaseFileName = convertToCamelCase(fileName);

      if (contentType.startsWith('image/')) {
        categorizedObjects.images[camelCaseFileName] = path;
      } else if (contentType.startsWith('audio/')) {
        categorizedObjects.audio[camelCaseFileName] = path;
      } else if (contentType.startsWith('video/')) {
        categorizedObjects.video[camelCaseFileName] = path;
      }
    }
  });

  if (data.nextPageToken) {
    return listObjects(bucketName, whitelist, language, data.nextPageToken, categorizedObjects);
  } else {
    return categorizedObjects;
  }
}

function isLanguageAndDeviceValid(filePath, languageCode, device) {
  const parts = filePath.split('/');
  if (parts[0] === 'shared') {
    return true; // Shared folder is always valid
  }

  if (parts[0] === languageCode) {
    return parts.length > 1 && (parts[1] === device || parts[1] === 'shared');
  }

  return false; // Not a valid path
}

// TODO: allow nested whitelisting (whitelisting within an already whitelisted folder)
function isWhitelisted(filePath, whitelist) {
  const parts = filePath.split('/');
  for (const [parent, children] of Object.entries(whitelist)) {
    const parentIndex = parts.indexOf(parent);
    if (parentIndex !== -1 && parts.length > parentIndex + 1) {
      const childFolder = parts[parentIndex + 1];
      if (children.includes(childFolder)) {
        return true;
      } else {
        return false; // Whitelist applies, but this folder is not allowed
      }
    }
  }
  return true; // Whitelist does not apply to this file's level
}

// function isLanguageCodeValid(filePath, languageCode) {
//   const parts = filePath.split('/');
//   if (parts.length > 1) {
//     return parts[0] === languageCode || parts[0] === 'shared';
//   }
//   return false;
// }

function convertToCamelCase(str) {
  return str.replace(/[-_\.]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (c) => c.toLowerCase());
}
