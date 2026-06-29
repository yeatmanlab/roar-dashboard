import { camelize } from './camelize';
import { taskStore } from '../../../taskStore';
import Papa from 'papaparse';

import 'regenerator-runtime/runtime';

let translations: Record<string, string> = {};

function parseTranslations(translationData: Record<string, string>[]) {
  for (const [key, value] of Object.entries(translationData)) {
    translations[camelize(key.trim())] = value as unknown as string;
  }
}

export const getTranslations = async (isDev: boolean, taskName: string, configLanguage?: string) => {
  // adult reasoning strings are in the math item bank
  if (taskName === 'adult-reasoning') {
    taskName = 'egma-math';
  }

  async function downloadJson(url: string): Promise<Record<string, string>[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch translations (${response.status}): ${url}`);
    }
    const data: unknown = await response.json();
    const rows = data as Record<string, string>[];

    parseTranslations(rows);
    return rows;
  }

  async function loadTranslationJsons(urls: string[]) {
    return Promise.all(urls.map((url) => downloadJson(url)));
  }

  async function fetchData() {
    const urls = [
      `https://storage.googleapis.com/levante-assets-${
        isDev ? 'dev' : 'prod'
      }/translations/itembank/general/${configLanguage}/item-bank-translations.json`,
    ];

    // Load different json if hearts-and-flowers and isRoarApp
    if (taskName !== 'hearts-and-flowers' || !taskStore().isRoarApp) {
      urls.push(
        `https://storage.googleapis.com/levante-assets-${
          isDev ? 'dev' : 'prod'
        }/translations/itembank/${taskName}/${configLanguage}/item-bank-translations.json`,
      );
    } else if (taskName === 'hearts-and-flowers' && taskStore().isRoarApp) {
      urls.push(
        `https://storage.googleapis.com/roar-levante-tasks/translations/itembank/hearts-and-flowers/${configLanguage}/item-bank-translations.json`,
      );
    }

    // hostile attribution requires some strings in the theory of mind item bank
    if (taskName === 'hostile-attribution') {
      urls.push(
        `https://storage.googleapis.com/levante-assets-${
          isDev ? 'dev' : 'prod'
        }/translations/itembank/theory-of-mind/${configLanguage}/item-bank-translations.json`,
      );
    }
    try {
      // The intro task only needs the shared/general bank — there is no task-specific `intro`
      // item bank, so fetching one would 404. urls[0] is always the general bank.
      await loadTranslationJsons(taskName === 'intro' ? [urls[0]] : urls);
      taskStore('translations', translations);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  await fetchData();
};

// Temporarily keep these here for backward compatibility (roar-inference)
function getRoarRowData(row: Record<string, string>, language: string, nonLocalDialect: string) {
  const translation = row[language.toLowerCase()];

  // Only need this because we don't have base language translations for all languages.
  // Ex we have 'es-co' but not 'es'
  const noBaseLang = Object.keys(row).find((key) => key.includes(nonLocalDialect)) || '';
  return translation || row[nonLocalDialect] || row[noBaseLang] || row['en'];
}

function parseRoarTranslations(translationData: Record<string, string>[], configLanguage: string) {
  const nonLocalDialect = configLanguage.split('-')[0].toLowerCase();

  translationData.forEach((row) => {
    translations[camelize(row.item_id)] = getRoarRowData(row, configLanguage, nonLocalDialect);
  });

  taskStore('translations', translations);
}

export const getRoarTranslations = async (configLanguage?: string) => {
  if (!configLanguage) {
    return;
  }

  function downloadCSV(url: string) {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          parseRoarTranslations(results.data, configLanguage || '');
          resolve(results.data);
        },
        error: function (error) {
          reject(error);
        },
      });
    });
  }

  async function parseCSVs(urls: string[]) {
    const promises = urls.map((url) => downloadCSV(url));
    return Promise.all(promises);
  }

  async function fetchData() {
    const urls = [
      // This will eventually be split into separate files
      `https://storage.googleapis.com/road-dashboard/item-bank-translations.csv`,
    ];

    try {
      await parseCSVs(urls);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  await fetchData();
};
