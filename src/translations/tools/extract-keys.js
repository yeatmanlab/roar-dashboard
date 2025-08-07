#!/usr/bin/env node

/**
 * Translation Key Extraction Tool
 * Scans Vue/JS/TS files for i18n usage and updates translation files
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

// Patterns to match i18n usage
const I18N_PATTERNS = [
  /\$t\(['"`]([^'"`]+)['"`]\)/g,           // $t('key')
  /\$tc\(['"`]([^'"`]+)['"`]/g,           // $tc('key', count)
  /\$tm\(['"`]([^'"`]+)['"`]\)/g,         // $tm('key')
  /t\(['"`]([^'"`]+)['"`]\)/g,            // t('key') from composable
  /useI18n\(\)\.t\(['"`]([^'"`]+)['"`]\)/g, // useI18n().t('key')
];

const COMPONENT_MAPPING = {
  'auth': ['signin', 'consent', 'password-reset'],
  'components': ['navbar', 'sidebar', 'game-tabs', 'tasks', 'sentry-form'],
  'pages': ['home-participant', 'home-selector', 'signin', 'not-found', 'profile'],
  'surveys': ['user-survey']
};

class KeyExtractor {
  constructor() {
    this.extractedKeys = new Set();
    this.usageMap = new Map();
    this.missingKeys = new Set();
  }

  async scanFiles() {
    console.log('🔍 Scanning files for translation keys...');
    
    const patterns = [
      'src/**/*.vue',
      'src/**/*.ts',
      'src/**/*.js'
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: projectRoot });
      
      for (const file of files) {
        await this.scanFile(path.join(projectRoot, file));
      }
    }

    console.log(`✅ Found ${this.extractedKeys.size} unique translation keys`);
  }

  async scanFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(projectRoot, filePath);

      for (const pattern of I18N_PATTERNS) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const key = match[1];
          this.extractedKeys.add(key);
          
          if (!this.usageMap.has(key)) {
            this.usageMap.set(key, []);
          }
          this.usageMap.get(key).push({
            file: relativePath,
            line: this.getLineNumber(content, match.index)
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not scan ${filePath}: ${error.message}`);
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\\n').length;
  }

  async validateTranslations() {
    console.log('🔍 Validating existing translations...');
    
    try {
      const translationKeys = JSON.parse(
        await fs.readFile(path.join(__dirname, '../base/translation-keys.json'), 'utf-8')
      );

      const existingKeys = new Set();
      Object.values(translationKeys.keys).forEach(keyArray => {
        keyArray.forEach(key => existingKeys.add(key));
      });

      // Find missing keys
      for (const key of this.extractedKeys) {
        if (!existingKeys.has(key)) {
          this.missingKeys.add(key);
        }
      }

      if (this.missingKeys.size > 0) {
        console.log(`❌ Found ${this.missingKeys.size} missing translation keys:`);
        for (const key of this.missingKeys) {
          console.log(`   - ${key}`);
          if (this.usageMap.has(key)) {
            this.usageMap.get(key).forEach(usage => {
              console.log(`     Used in: ${usage.file}:${usage.line}`);
            });
          }
        }
      } else {
        console.log('✅ All keys are properly registered');
      }

    } catch (error) {
      console.error(`❌ Error validating translations: ${error.message}`);
    }
  }

  async generateUsageReport() {
    const reportPath = path.join(__dirname, '../reports/key-usage-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    const report = {
      generatedAt: new Date().toISOString(),
      totalKeys: this.extractedKeys.size,
      missingKeys: this.missingKeys.size,
      keyUsage: Object.fromEntries(this.usageMap),
      missingKeysList: Array.from(this.missingKeys)
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Usage report generated: ${reportPath}`);
  }

  async updateKeyRegistry() {
    if (this.missingKeys.size === 0) return;

    console.log('🔄 Updating translation key registry...');
    
    const registryPath = path.join(__dirname, '../base/translation-keys.json');
    const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'));

    // Simple categorization based on key prefixes
    for (const key of this.missingKeys) {
      let category = 'uncategorized';
      
      for (const [cat, components] of Object.entries(COMPONENT_MAPPING)) {
        if (components.some(comp => key.toLowerCase().includes(comp))) {
          category = cat;
          break;
        }
      }

      if (!registry.keys[category]) {
        registry.keys[category] = [];
      }
      
      if (!registry.keys[category].includes(key)) {
        registry.keys[category].push(key);
      }
    }

    registry.registry.lastScanned = new Date().toISOString();
    
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
    console.log('✅ Translation key registry updated');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'scan';

  const extractor = new KeyExtractor();

  switch (command) {
    case 'scan':
      await extractor.scanFiles();
      await extractor.validateTranslations();
      await extractor.generateUsageReport();
      break;
      
    case 'update':
      await extractor.scanFiles();
      await extractor.validateTranslations();
      await extractor.updateKeyRegistry();
      await extractor.generateUsageReport();
      break;
      
    case 'report':
      await extractor.scanFiles();
      await extractor.generateUsageReport();
      break;
      
    default:
      console.log(`
Usage: node extract-keys.js [command]

Commands:
  scan    - Scan files and validate translations (default)
  update  - Update translation registry with missing keys
  report  - Generate usage report only

Options:
  --help  - Show this help message
      `);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main().catch(console.error);
}

export { KeyExtractor };