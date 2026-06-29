//@ts-ignore
import { getDevice } from '@bdelab/roar-utils';
import { camelize } from './camelize';

type CategorizedObjectsType = {
  images: Record<string, string>;
  audio: Record<string, string>;
  video: Record<string, string>;
};

type ResponseItemType = {
  name: string;
  contentType: string;
};

type ResponseDataType = {
  items: ResponseItemType[];
  nextPageToken: string;
};

export async function getMediaAssets(
  bucketName: string,
  whitelist: Record<string, any> = {},
  language: string,
  taskName: string,
  nextPageToken = '',
  categorizedObjects: CategorizedObjectsType = { images: {}, audio: {}, video: {} },
) {
  const parts = bucketName.split('/');
  const bucket = parts[0];
  const folder = parts.slice(1).join('/');
  const baseUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${folder}/`;

  let url = baseUrl;
  if (nextPageToken) {
    url += `&pageToken=${nextPageToken}`;
  }

  let data: ResponseDataType;
  let response: Response;

  response = await fetch(url);
  data = await response.json();

  // add temporary fallback for en-US and de-DE until we have the correct folders in the bucket
  if (!data.items || data.items.length === 0) {
    if (folder === 'audio/en-US') {
      response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=audio/en/`);
      data = await response.json();
    } else if (folder === 'audio/de-DE') {
      response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=audio/de/`);
      data = await response.json();
    }
  }

  data.items.forEach((item) => {
    if (isLanguageAndDeviceValid(item.name, language, taskName) && isWhitelisted(item.name, whitelist)) {
      const contentType = item.contentType;
      const id = item.name;
      const path = `https://storage.googleapis.com/${bucket}/${id}`;
      const fileName = id.split('/').pop()?.split('.')[0] || '';
      const camelCaseFileName = camelize(fileName);

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
    return getMediaAssets(bucketName, whitelist, language, taskName, data.nextPageToken, categorizedObjects);
  } else {
    return categorizedObjects;
  }
}

function isLanguageAndDeviceValid(filePath: string, languageCode: string, taskName: string) {
  const parts = filePath.split('/');
  if (parts.length !== 3) {
    return false;
  } else if (parts[0] === 'visual') {
    // visual assets have task prefix
    return parts[1] === taskName && parts[2].length !== 0;
  } else if (parts[0] === 'audio') {
    // audio assets have language prefix
    return (parts[1] === languageCode || parts[1] === languageCode.slice(0, 2)) && parts[2].length !== 0;
  }

  return false; // Not a valid path
}

// TODO: allow nested whitelisting (whitelisting within an already whitelisted folder)
function isWhitelisted(filePath: string, whitelist: Record<string, string[]>) {
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

// Temporarily keep these here for backward compatibility (roar-inference)
export async function getRoarMediaAssets(
  bucketName: string,
  whitelist: Record<string, any> = {},
  language: string,
  nextPageToken = '',
  categorizedObjects: CategorizedObjectsType = { images: {}, audio: {}, video: {} },
) {
  const device = getDevice();

  const baseUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o`;
  let url = baseUrl;
  if (nextPageToken) {
    url += `?pageToken=${nextPageToken}`;
  }

  const response = await fetch(url);
  const data: ResponseDataType = await response.json();

  data.items.forEach((item) => {
    if (isRoarLanguageAndDeviceValid(item.name, language, device) && isRoarWhitelisted(item.name, whitelist)) {
      const contentType = item.contentType;
      const id = item.name;
      const path = `https://storage.googleapis.com/${bucketName}/${id}`;
      const fileName = id.split('/').pop()?.split('.')[0] || '';
      const camelCaseFileName = camelize(fileName);

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
    return getRoarMediaAssets(bucketName, whitelist, language, data.nextPageToken, categorizedObjects);
  } else {
    return categorizedObjects;
  }
}

function isRoarLanguageAndDeviceValid(filePath: string, languageCode: string, device: string) {
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
function isRoarWhitelisted(filePath: string, whitelist: Record<string, string[]>) {
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
