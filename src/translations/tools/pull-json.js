#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const crowdinConfig = path.resolve(projectRoot, 'src/translations/crowdin/crowdin.yml');
const mainDashRoot = path.resolve(projectRoot, 'src/translations/main/dashboard');
const mainDashComponents = path.resolve(mainDashRoot, 'components');
const consolidatedRoot = path.resolve(projectRoot, 'src/translations/consolidated');
const consolidatedComponents = path.resolve(consolidatedRoot, 'components');

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
}

function ensureCrowdinDownload() {
  if (!process.env.CROWDIN_API_TOKEN) {
    console.error('CROWDIN_API_TOKEN not set. export CROWDIN_API_TOKEN=YOUR_TOKEN');
    process.exit(1);
  }

  // Try global crowdin first
  const res = run('crowdin', ['download', '--config', crowdinConfig]);
  if (res.error && res.error.code === 'ENOENT') {
    const resNpx = run('npx', ['-y', '-p', '@crowdin/cli', 'crowdin', 'download', '--config', crowdinConfig]);
    if (resNpx.status !== 0) process.exit(resNpx.status || 1);
    return;
  }
  if (res.status !== 0) process.exit(res.status || 1);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function createBackup() {
  const backupDir = path.join(consolidatedRoot, '.backup');
  ensureDir(backupDir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `pre-sync-${timestamp}`);
  ensureDir(backupPath);
  
  // Backup consolidated files
  if (fs.existsSync(consolidatedRoot)) {
    const files = fs.readdirSync(consolidatedRoot);
    for (const file of files) {
      if (file.endsWith('.csv')) {
        const src = path.join(consolidatedRoot, file);
        const dest = path.join(backupPath, file);
        fs.copyFileSync(src, dest);
      }
    }
  }
  
  // Backup component files
  if (fs.existsSync(consolidatedComponents)) {
    const componentBackupDir = path.join(backupPath, 'components');
    ensureDir(componentBackupDir);
    
    const files = fs.readdirSync(consolidatedComponents);
    for (const file of files) {
      if (file.endsWith('.csv')) {
        const src = path.join(consolidatedComponents, file);
        const dest = path.join(componentBackupDir, file);
        fs.copyFileSync(src, dest);
      }
    }
  }
  
  console.log(`📦 Created backup at ${backupPath}`);
  return backupPath;
}

function syncCsvsToConsolidated() {
  // Create backup before syncing
  const backupPath = createBackup();
  
  ensureDir(consolidatedRoot);
  ensureDir(consolidatedComponents);

  // Copy dashboard-translations.csv
  const dashCsv = path.join(mainDashRoot, 'dashboard-translations.csv');
  if (fs.existsSync(dashCsv)) {
    fs.copyFileSync(dashCsv, path.join(consolidatedRoot, 'dashboard-translations.csv'));
  }

  // Copy component CSVs
  if (fs.existsSync(mainDashComponents)) {
    const entries = fs.readdirSync(mainDashComponents);
    for (const entry of entries) {
      if (!entry.endsWith('-translations.csv')) continue;
      const src = path.join(mainDashComponents, entry);
      const dest = path.join(consolidatedComponents, entry);
      fs.copyFileSync(src, dest);
    }
  }
}

function buildJson() {
  const script = path.resolve(projectRoot, 'src/translations/tools/csv-to-json.js');
  const res = run('node', [script]);
  if (res.status !== 0) process.exit(res.status || 1);
}

function runSafetyCheck() {
  console.log('🔍 Running translation safety check...');
  const script = path.resolve(projectRoot, 'src/translations/tools/translation-safety-check.js');
  const res = run('node', [script]);
  if (res.status !== 0) {
    console.error('❌ Translation safety check failed. Aborting sync to prevent data loss.');
    process.exit(res.status || 1);
  }
}

function main() {
  console.log('🌐 Pulling translations from Crowdin...');
  ensureCrowdinDownload();
  console.log('📦 Syncing downloaded CSVs to consolidated/ ...');
  syncCsvsToConsolidated();
  console.log('🔍 Running translation safety check...');
  runSafetyCheck();
  console.log('🔧 Regenerating per-locale JSON...');
  buildJson();
  console.log('✅ Done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}


