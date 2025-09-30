import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

function listCsvFiles() {
  const roots = [
    path.join('src', 'translations', 'consolidated'),
    path.join('src', 'translations', 'consolidated', 'components'),
  ];
  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root);
    for (const entry of entries) {
      const fp = path.join(root, entry);
      if (fs.statSync(fp).isFile() && fp.toLowerCase().endsWith('.csv')) files.push(fp);
    }
  }
  files.sort();
  return files;
}

function computeHashOfFiles(filePaths) {
  const hasher = crypto.createHash('sha256');
  for (const fp of filePaths) {
    const stat = fs.statSync(fp);
    hasher.update(fp);
    hasher.update(String(stat.mtimeMs));
    const content = fs.readFileSync(fp);
    hasher.update(content);
  }
  return hasher.digest('hex');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function runCsvToJson() {
  const result = spawnSync('node', [path.join('src', 'translations', 'tools', 'csv-to-json.js')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const csvFiles = listCsvFiles();
  if (!csvFiles.length) {
    console.log('⏭  No consolidated CSV files found. Skipping CSV→JSON.');
    return;
  }

  const cacheDir = path.join('.cache');
  const cacheFile = path.join(cacheDir, 'i18n-csv.hash');
  ensureDir(cacheDir);

  const currentHash = computeHashOfFiles(csvFiles);
  const prevHash = fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile, 'utf8') : '';

  if (prevHash === currentHash) {
    console.log('⏭  CSVs unchanged since last run. Skipping regeneration.');
    return;
  }

  console.log('🔁 CSV changes detected. Regenerating per-locale JSON...');
  runCsvToJson();
  fs.writeFileSync(cacheFile, currentHash);
  console.log('✅ CSV→JSON complete. Cache updated.');
}

main();
