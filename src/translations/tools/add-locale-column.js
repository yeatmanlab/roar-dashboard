#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const consolidatedRoot = path.join('src', 'translations', 'consolidated');

function listCsvFiles() {
  const roots = [consolidatedRoot, path.join(consolidatedRoot, 'components')];
  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      const fp = path.join(root, entry);
      if (fs.statSync(fp).isFile() && fp.toLowerCase().endsWith('.csv')) files.push(fp);
    }
  }
  return files;
}

function parseCsv(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return Array.isArray(data) ? data : [];
}

function toCsvLine(values) {
  return values
    .map((v) => {
      const s = v == null ? '' : String(v);
      const escaped = s.replace(/\r?\n/g, '\\n').replace(/\r/g, '\\r');
      return escaped.includes(',') || escaped.includes('"') || s.includes('\n') || s.includes('\r')
        ? '"' + escaped.replace(/"/g, '""') + '"'
        : escaped;
    })
    .join(',');
}

function writeCsv(filePath, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const out = [toCsvLine(headers)];
  rows.forEach((r) => out.push(toCsvLine(headers.map((h) => r[h] ?? ''))));
  fs.writeFileSync(filePath, out.join('\n'));
}

function main() {
  const targetLocale = (process.env.I18N_NEW_LOCALE || '').trim();
  const seedFrom = (process.env.I18N_SEED_FROM || '').trim();
  if (!targetLocale) {
    console.error('Usage: I18N_NEW_LOCALE=<locale> [I18N_SEED_FROM=<base>] node add-locale-column.js');
    process.exit(1);
  }
  const files = listCsvFiles();
  if (!files.length) {
    console.log('No CSV files found.');
    process.exit(0);
  }

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const rows = parseCsv(raw);
    if (!rows.length) continue;

    const headers = Object.keys(rows[0]);
    if (headers.includes(targetLocale)) {
      console.log(`⏭  ${file} already has column ${targetLocale}`);
      continue;
    }

    const seeded = rows.map((r) => {
      const clone = { ...r };
      if (seedFrom && seedFrom in r) clone[targetLocale] = r[seedFrom];
      else clone[targetLocale] = '';
      return clone;
    });

    writeCsv(file, seeded);
    console.log(`✅ Added ${targetLocale} to ${file}${seedFrom ? ` (seeded from ${seedFrom})` : ''}`);
  }
}

main();
