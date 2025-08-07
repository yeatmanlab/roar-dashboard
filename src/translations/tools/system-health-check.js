#!/usr/bin/env node

/**
 * Translation System Health Check
 * Validates that all components of the translation system are properly configured
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TranslationSystemHealthCheck {
  constructor() {
    this.translationsDir = path.join(__dirname, '..');
    this.issues = [];
    this.warnings = [];
    this.successes = [];
  }

  async runHealthCheck() {
    console.log('🏥 Running Translation System Health Check...\n');

    // Check file structure
    await this.checkFileStructure();
    
    // Check configuration files
    await this.checkConfiguration();
    
    // Check translation files
    await this.checkTranslationFiles();
    
    // Check dependencies
    await this.checkDependencies();
    
    // Check environment
    await this.checkEnvironment();
    
    // Generate report
    this.generateReport();
  }

  async checkFileStructure() {
    console.log('📁 Checking file structure...');
    
    const requiredPaths = [
      'base/component-manifest.json',
      'base/metadata-schema.json', 
      'base/translation-keys.json',
      'crowdin/crowdin.yml',
      'crowdin/glossary.csv',
      'crowdin/context/dashboard-overview.md',
      'tools/validate-translations.js',
      'tools/crowdin-sync.js',
      'tools/crowdin-seed-upload.js',
      'locales/en',
      'locales/es',
      'locales/de'
    ];

    for (const filePath of requiredPaths) {
      const fullPath = path.join(this.translationsDir, filePath);
      try {
        await fs.access(fullPath);
        this.success(`✅ Found: ${filePath}`);
      } catch (error) {
        this.issue(`❌ Missing: ${filePath}`);
      }
    }
  }

  async checkConfiguration() {
    console.log('\n⚙️  Checking configuration files...');

    // Check Crowdin config
    try {
      const crowdinConfig = await fs.readFile(
        path.join(this.translationsDir, 'crowdin/crowdin.yml'),
        'utf8'
      );
      
      if (crowdinConfig.includes('levantetranslations')) {
        this.success('✅ Crowdin project configured correctly');
      } else {
        this.issue('❌ Crowdin project not set to "levantetranslations"');
      }

      if (crowdinConfig.includes('dashboard/')) {
        this.success('✅ Dashboard folder structure configured');
      } else {
        this.warning('⚠️ Dashboard folder structure not found in Crowdin config');
      }
    } catch (error) {
      this.issue('❌ Could not read Crowdin configuration');
    }

    // Check component manifest
    try {
      const manifest = JSON.parse(
        await fs.readFile(
          path.join(this.translationsDir, 'base/component-manifest.json'),
          'utf8'
        )
      );
      
      const componentCount = Object.keys(manifest.components || {}).length;
      if (componentCount > 0) {
        this.success(`✅ Component manifest has ${componentCount} components`);
      } else {
        this.issue('❌ No components found in manifest');
      }
    } catch (error) {
      this.issue('❌ Could not read component manifest');
    }
  }

  async checkTranslationFiles() {
    console.log('\n🌐 Checking translation files...');

    const locales = ['en', 'es', 'de', 'es-CO', 'en-US'];
    
    for (const locale of locales) {
      const localePath = path.join(this.translationsDir, 'locales', locale);
      
      try {
        const stats = await fs.stat(localePath);
        if (stats.isDirectory()) {
          const files = await this.countFilesRecursively(localePath);
          this.success(`✅ ${locale}: ${files} translation files`);
        }
      } catch (error) {
        this.warning(`⚠️ ${locale}: Directory not found or empty`);
      }
    }

    // Check for legacy files
    const legacyFiles = [
      'en/en-componentTranslations.json',
      'es/es-componentTranslations.json',
      'de/de-componentTranslations.json'
    ];

    let legacyCount = 0;
    for (const file of legacyFiles) {
      try {
        await fs.access(path.join(this.translationsDir, file));
        legacyCount++;
      } catch (error) {
        // File doesn't exist, which is ok
      }
    }

    if (legacyCount > 0) {
      this.success(`✅ Found ${legacyCount} legacy files for migration`);
    }
  }

  async checkDependencies() {
    console.log('\n📦 Checking dependencies...');

    try {
      const packageJson = JSON.parse(
        await fs.readFile(
          path.join(this.translationsDir, '../../package.json'),
          'utf8'
        )
      );

      const requiredDeps = [
        '@crowdin/cli',
        'lodash'
      ];

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const dep of requiredDeps) {
        if (allDeps[dep]) {
          this.success(`✅ ${dep}: ${allDeps[dep]}`);
        } else {
          this.issue(`❌ Missing dependency: ${dep}`);
        }
      }

      // Check scripts
      const requiredScripts = [
        'i18n:validate',
        'i18n:crowdin:upload',
        'i18n:crowdin:download',
        'i18n:crowdin:seed',
        'i18n:migrate'
      ];

      for (const script of requiredScripts) {
        if (packageJson.scripts[script]) {
          this.success(`✅ Script: ${script}`);
        } else {
          this.issue(`❌ Missing script: ${script}`);
        }
      }

    } catch (error) {
      this.issue('❌ Could not read package.json');
    }
  }

  checkEnvironment() {
    console.log('\n🔐 Checking environment...');

    if (process.env.CROWDIN_API_TOKEN) {
      this.success('✅ CROWDIN_API_TOKEN is set');
    } else {
      this.warning('⚠️ CROWDIN_API_TOKEN not set (required for Crowdin operations)');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 20) {
      this.success(`✅ Node.js version: ${nodeVersion}`);
    } else {
      this.issue(`❌ Node.js version ${nodeVersion} is too old (requires 20+)`);
    }
  }

  async countFilesRecursively(dir) {
    let count = 0;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          count += await this.countFilesRecursively(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.json')) {
          count++;
        }
      }
    } catch (error) {
      // Directory doesn't exist or is inaccessible
    }
    return count;
  }

  success(message) {
    this.successes.push(message);
    console.log(`  ${message}`);
  }

  warning(message) {
    this.warnings.push(message);
    console.log(`  ${message}`);
  }

  issue(message) {
    this.issues.push(message);
    console.log(`  ${message}`);
  }

  generateReport() {
    console.log('\n📊 Health Check Summary:');
    console.log(`   ✅ Successes: ${this.successes.length}`);
    console.log(`   ⚠️ Warnings: ${this.warnings.length}`);
    console.log(`   ❌ Issues: ${this.issues.length}`);

    if (this.issues.length === 0 && this.warnings.length <= 1) {
      console.log('\n🎉 Translation system is healthy and ready to use!');
      console.log('\nNext steps:');
      console.log('1. Set CROWDIN_API_TOKEN environment variable');
      console.log('2. Run: npm run i18n:crowdin:seed (one-time upload)');
      console.log('3. Run: npm run i18n:validate (check current status)');
    } else if (this.issues.length === 0) {
      console.log('\n✅ Translation system is mostly healthy!');
      console.log('Address the warnings above for optimal performance.');
    } else {
      console.log('\n⚠️ Translation system has issues that need attention:');
      this.issues.forEach(issue => console.log(`   ${issue}`));
    }

    console.log('\n📚 Documentation: src/translations/README.md');
    console.log('🔗 Crowdin Project: https://crowdin.com/project/levantetranslations');
  }
}

// CLI usage
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const healthCheck = new TranslationSystemHealthCheck();
  healthCheck.runHealthCheck().catch(console.error);
}

export { TranslationSystemHealthCheck };
