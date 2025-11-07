#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const consolidatedRoot = path.resolve(projectRoot, 'src/translations/consolidated');
const consolidatedComponents = path.resolve(consolidatedRoot, 'components');

/**
 * Translation Safety Check
 * 
 * This script validates that critical translations are preserved during the
 * Crowdin sync process. It checks for known problematic patterns and ensures
 * that important translations aren't accidentally lost.
 */

// Known critical translations that should never be empty
const CRITICAL_TRANSLATIONS = {
  'components/game-tabs.matrixReasoningDescription': {
    'es-CO': 'Encuentra la pieza que falta para completar el rrompecabezas.',
    'es-AR': 'Encuentra la pieza que falta para completar el rrompecabezas.'
  },
  'components/game-tabs.matrixReasoningName': {
    'es-CO': 'Razonamiento Matricial',
    'es-AR': 'Razonamiento Matricial'
  }
};

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    if (values.length !== headers.length) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    rows.push(row);
  }
  
  return rows;
}

function checkCriticalTranslations(filePath) {
  const rows = readCsv(filePath);
  const issues = [];
  
  for (const row of rows) {
    const identifier = row.identifier;
    if (!identifier || !CRITICAL_TRANSLATIONS[identifier]) continue;
    
    const expected = CRITICAL_TRANSLATIONS[identifier];
    for (const [locale, expectedValue] of Object.entries(expected)) {
      const actualValue = (row[locale] || '').trim();
      if (actualValue !== expectedValue) {
        issues.push({
          file: path.basename(filePath),
          identifier,
          locale,
          expected: expectedValue,
          actual: actualValue,
          severity: actualValue === '' ? 'ERROR' : 'WARNING'
        });
      }
    }
  }
  
  return issues;
}

function checkTranslationCoverage(filePath) {
  const rows = readCsv(filePath);
  if (rows.length === 0) return [];
  
  const headers = Object.keys(rows[0]);
  const localeHeaders = headers.filter(h => h !== 'identifier' && h !== 'label');
  const issues = [];
  
  // Check for completely empty locale columns
  for (const locale of localeHeaders) {
    const hasAnyTranslations = rows.some(row => (row[locale] || '').trim() !== '');
    if (!hasAnyTranslations) {
      issues.push({
        file: path.basename(filePath),
        type: 'EMPTY_LOCALE',
        locale,
        severity: 'WARNING'
      });
    }
  }
  
  // Check for significant drops in translation coverage
  const coverage = {};
  for (const locale of localeHeaders) {
    const total = rows.length;
    const translated = rows.filter(row => (row[locale] || '').trim() !== '').length;
    const percentage = total > 0 ? Math.round((translated / total) * 100) : 0;
    coverage[locale] = { total, translated, percentage };
    
    // Flag if coverage is suspiciously low (less than 10%)
    if (percentage < 10 && total > 5) {
      issues.push({
        file: path.basename(filePath),
        type: 'LOW_COVERAGE',
        locale,
        percentage,
        severity: 'WARNING'
      });
    }
  }
  
  return { issues, coverage };
}

function main() {
  console.log('🔍 Running translation safety checks...');
  
  const allIssues = [];
  const allCoverage = {};
  
  // Check component CSV files
  if (fs.existsSync(consolidatedComponents)) {
    const files = fs.readdirSync(consolidatedComponents)
      .filter(f => f.endsWith('-translations.csv'));
    
    for (const file of files) {
      const filePath = path.join(consolidatedComponents, file);
      console.log(`  Checking ${file}...`);
      
      // Check critical translations
      const criticalIssues = checkCriticalTranslations(filePath);
      allIssues.push(...criticalIssues);
      
      // Check coverage
      const { issues: coverageIssues, coverage } = checkTranslationCoverage(filePath);
      allIssues.push(...coverageIssues);
      allCoverage[file] = coverage;
    }
  }
  
  // Report results
  if (allIssues.length === 0) {
    console.log('✅ All translation safety checks passed');
    return;
  }
  
  console.log(`\n⚠️  Found ${allIssues.length} issues:`);
  
  const errors = allIssues.filter(i => i.severity === 'ERROR');
  const warnings = allIssues.filter(i => i.severity === 'WARNING');
  
  if (errors.length > 0) {
    console.log('\n🚨 ERRORS (must be fixed):');
    errors.forEach(issue => {
      if (issue.identifier) {
        console.log(`  ${issue.file}: ${issue.identifier} (${issue.locale})`);
        console.log(`    Expected: "${issue.expected}"`);
        console.log(`    Actual: "${issue.actual}"`);
      } else if (issue.type === 'EMPTY_LOCALE') {
        console.log(`  ${issue.file}: ${issue.locale} column is completely empty`);
      } else if (issue.type === 'LOW_COVERAGE') {
        console.log(`  ${issue.file}: ${issue.locale} has only ${issue.percentage}% coverage`);
      }
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(issue => {
      if (issue.identifier) {
        console.log(`  ${issue.file}: ${issue.identifier} (${issue.locale}) - "${issue.actual}"`);
      } else if (issue.type === 'EMPTY_LOCALE') {
        console.log(`  ${issue.file}: ${issue.locale} column is completely empty`);
      } else if (issue.type === 'LOW_COVERAGE') {
        console.log(`  ${issue.file}: ${issue.locale} has only ${issue.percentage}% coverage`);
      }
    });
  }
  
  // Show coverage summary
  console.log('\n📊 Translation Coverage Summary:');
  for (const [file, coverage] of Object.entries(allCoverage)) {
    console.log(`  ${file}:`);
    for (const [locale, stats] of Object.entries(coverage)) {
      console.log(`    ${locale}: ${stats.translated}/${stats.total} (${stats.percentage}%)`);
    }
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Translation safety check failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ Translation safety check completed with warnings.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
