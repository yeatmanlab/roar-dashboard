#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../..');
const translationsRoot = path.resolve(projectRoot, 'src/translations');
const localesRoot = path.resolve(translationsRoot, 'locales');
const consolidatedRoot = path.resolve(translationsRoot, 'consolidated');
const crowdinConfig = path.resolve(translationsRoot, 'crowdin/crowdin.yml');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(',').map((h) => h.trim());
  return { headers, rows: rows.map((r) => r.split(',')) };
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function rebuildFromConsolidated() {
  ensureDir(localesRoot);
  const files = fs.existsSync(consolidatedRoot) ? fs.readdirSync(consolidatedRoot) : [];
  const consolidated = files.filter((f) => f.startsWith('dashboard-') && f.endsWith('.csv'));
  if (!consolidated.length) return;

  const languageSet = new Set(['en']);

  for (const csvName of consolidated) {
    const { headers, rows } = readCsv(path.join(consolidatedRoot, csvName));
    // identifier,label,en,es-co,de,de-ch,en-so,fr-ca,nl
    const langHeaders = headers.slice(2);
    langHeaders.forEach((h) => languageSet.add(h.trim().toLowerCase()));

    const section = csvName.replace('dashboard-', '').replace('-translations.csv', '');
    // Group rows by component path in identifier like components/navbar.title
    const componentToEntries = new Map();
    for (const row of rows) {
      const identifier = row[0];
      const label = row[1];
      const perLang = row.slice(2);
      const [top, ...rest] = identifier.split('.');
      const componentPath = rest.length ? `${top}` : top;
      const entry = { identifier, label, perLang };
      const list = componentToEntries.get(componentPath) ?? [];
      list.push(entry);
      componentToEntries.set(componentPath, list);
    }

    for (const lang of languageSet) {
      const langDir = path.join(localesRoot, lang);
      ensureDir(langDir);

      for (const [component, entries] of componentToEntries.entries()) {
        const outDir = path.join(langDir, section);
        ensureDir(outDir);
        const outFile = path.join(outDir, `${component}.json`);
        const messages = {};
        for (const entry of entries) {
          const key = entry.identifier.split('.').slice(1).join('.');
          const langIndex = Array.from(langHeaders).findIndex((h) => h.toLowerCase() === lang.toLowerCase());
          const value = langIndex >= 0 ? entry.perLang[langIndex] ?? '' : '';
          if (key) messages[key] = value;
        }
        writeJson(outFile, messages);
      }
    }
  }
}

function runCrowdinDownload() {
  if (!process.env.CROWDIN_API_TOKEN) {
    console.warn('CROWDIN_API_TOKEN missing; skipping download');
    return;
  }
  const res = spawnSync('crowdin', ['download', '--config', crowdinConfig], { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status);
}

function main() {
  console.log('🌐 Crowdin Translation Download & Rebuild');
  runCrowdinDownload();
  console.log('🔧 Rebuilding modular JSON files...');
  rebuildFromConsolidated();
  console.log('✅ Done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
