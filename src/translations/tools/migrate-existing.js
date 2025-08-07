#!/usr/bin/env node

/**
 * Migration Tool for Existing Translations
 * Converts legacy translation files to new modular structure
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENT_MAPPING = {
  'authSignIn': 'auth/signin.json',
  'consentModal': 'auth/consent.json',
  'homeParticipant': 'pages/home-participant.json',
  'homeSelector': 'pages/home-selector.json',
  'gameTabs': 'components/game-tabs.json',
  'navBar': 'components/navbar.json',
  'notFound': 'pages/not-found.json',
  'participantSidebar': 'components/participant-sidebar.json',
  'pageSignIn': 'pages/signin.json',
  'tasks': 'components/tasks.json',
  'sentryForm': 'components/sentry-form.json',
  'userSurvey': 'surveys/user-survey.json',
  'profile': 'pages/profile.json'
};

const LOCALE_MAPPING = {
  'en-componentTranslations.json': 'en',
  'es-componentTranslations.json': 'es',
  'de-componentTranslations.json': 'de',
  'es-co-componentTranslations.json': 'es-CO',
  'en-us-componentTranslations.json': 'en-US'
};

class TranslationMigrator {
  constructor() {
    this.legacyDir = path.join(__dirname, '..');
    this.newLocalesDir = path.join(__dirname, '../locales');
  }

  async migrateAll() {
    console.log('🔄 Starting migration of existing translations...');
    
    // Migrate component translations
    await this.migrateLegacyTranslations();
    
    // Migrate individual score reports
    await this.migrateScoreReports();
    
    // Migrate page titles
    await this.migratePageTitles();
    
    console.log('✅ Migration completed successfully');
  }

  async migrateLegacyTranslations() {
    console.log('📁 Migrating component translations...');
    
    for (const [fileName, locale] of Object.entries(LOCALE_MAPPING)) {
      await this.migrateLocaleTranslations(fileName, locale);
    }
  }

  async migrateLocaleTranslations(fileName, locale) {
    console.log(`  🔄 Processing ${locale} (${fileName})...`);
    
    const legacyPaths = [
      path.join(this.legacyDir, locale, fileName),
      path.join(this.legacyDir, locale.split('-')[0], fileName), // fallback
      path.join(this.legacyDir, fileName) // old location
    ];

    let legacyData = null;
    let legacyPath = null;

    // Try to find the legacy file
    for (const testPath of legacyPaths) {
      try {
        legacyData = JSON.parse(await fs.readFile(testPath, 'utf-8'));
        legacyPath = testPath;
        break;
      } catch {
        // File doesn't exist, try next path
      }
    }

    if (!legacyData) {
      console.warn(`    ⚠️ Legacy file not found for ${locale}`);
      return;
    }

    console.log(`    📖 Found legacy file: ${legacyPath}`);

    // Create locale directory
    const localeDir = path.join(this.newLocalesDir, locale);
    await fs.mkdir(localeDir, { recursive: true });

    // Process each component
    for (const [component, translations] of Object.entries(legacyData)) {
      if (!COMPONENT_MAPPING[component]) {
        console.warn(`    ⚠️ Unknown component: ${component}`);
        continue;
      }

      await this.createModularFile(locale, component, translations);
    }

    console.log(`    ✅ Migrated ${Object.keys(legacyData).length} components for ${locale}`);
  }

  async createModularFile(locale, component, translations) {
    const relativePath = COMPONENT_MAPPING[component];
    const filePath = path.join(this.newLocalesDir, locale, relativePath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Convert to new format with metadata
    const modularData = {
      "$schema": "../../base/metadata-schema.json",
      "$metadata": {
        "component": component,
        "lastUpdated": new Date().toISOString(),
        "completeness": 100, // Assume existing translations are complete
        "context": this.getComponentContext(component),
        "migrated": true,
        "originalFormat": "legacy"
      },
      "translations": this.convertTranslations(translations)
    };

    await fs.writeFile(filePath, JSON.stringify(modularData, null, 2));
    console.log(`      ✅ Created: ${relativePath}`);
  }

  convertTranslations(legacyTranslations) {
    const result = {};

    for (const [key, value] of Object.entries(legacyTranslations)) {
      if (typeof value === 'string') {
        // Simple string value
        result[key] = {
          value,
          context: this.inferContext(key, value)
        };
      } else if (typeof value === 'object' && value !== null) {
        // Nested object
        result[key] = this.convertTranslations(value);
      } else {
        // Other types (numbers, booleans, etc.)
        result[key] = value;
      }
    }

    return result;
  }

  inferContext(key, value) {
    // Simple context inference based on key patterns
    if (key.toLowerCase().includes('button')) {
      return 'Button text';
    } else if (key.toLowerCase().includes('placeholder')) {
      return 'Input field placeholder';
    } else if (key.toLowerCase().includes('title') || key.toLowerCase().includes('header')) {
      return 'Page or section title';
    } else if (key.toLowerCase().includes('description')) {
      return 'Descriptive text';
    } else if (key.toLowerCase().includes('label')) {
      return 'Form or UI label';
    } else if (key.toLowerCase().includes('message') || key.toLowerCase().includes('text')) {
      return 'Message or general text';
    } else if (key.toLowerCase().includes('name')) {
      return 'Name or identifier';
    } else if (value.length > 100) {
      return 'Long descriptive text';
    } else if (value.length < 20) {
      return 'Short label or title';
    }
    
    return 'General text';
  }

  getComponentContext(component) {
    const contexts = {
      'authSignIn': 'User authentication and sign-in forms',
      'consentModal': 'User consent and assent modals',
      'homeParticipant': 'Participant dashboard home page',
      'homeSelector': 'Role selection and general home components',
      'gameTabs': 'Task and game tab interface',
      'navBar': 'Navigation bar component',
      'notFound': '404 error page',
      'participantSidebar': 'Participant information sidebar',
      'pageSignIn': 'Sign-in page content',
      'tasks': 'Task loading and preparation',
      'sentryForm': 'Error reporting form',
      'userSurvey': 'User survey components',
      'profile': 'User profile and settings'
    };

    return contexts[component] || 'Component translations';
  }

  async migrateScoreReports() {
    console.log('📊 Migrating individual score reports...');
    
    const scoreReportFiles = [
      { file: 'en/en-individualScoreReport.json', locale: 'en' },
      { file: 'en/us/en-us-individualScoreReport.json', locale: 'en-US' },
      { file: 'es/es-individualScoreReport.json', locale: 'es' },
      { file: 'es/co/es-co-individualScoreReport.json', locale: 'es-CO' }
    ];

    for (const { file, locale } of scoreReportFiles) {
      await this.migrateScoreReport(file, locale);
    }
  }

  async migrateScoreReport(filePath, locale) {
    const fullPath = path.join(this.legacyDir, filePath);
    
    try {
      const data = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
      
      const modularData = {
        "$schema": "../../base/metadata-schema.json",
        "$metadata": {
          "component": "individualScoreReport",
          "lastUpdated": new Date().toISOString(),
          "completeness": 100,
          "context": "Individual assessment score report generation",
          "migrated": true,
          "originalFormat": "legacy"
        },
        "translations": this.convertTranslations(data)
      };

      const outputPath = path.join(this.newLocalesDir, locale, 'components/individual-score-report.json');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(modularData, null, 2));
      
      console.log(`  ✅ Migrated score report for ${locale}`);
    } catch (error) {
      console.warn(`  ⚠️ Could not migrate score report for ${locale}: ${error.message}`);
    }
  }

  async migratePageTitles() {
    console.log('📄 Migrating page titles...');
    
    const pageTitleFiles = [
      { file: 'en/pageTitles.json', locale: 'en' },
      { file: 'en/us/pageTitles.json', locale: 'en-US' },
      { file: 'es/pageTitles.json', locale: 'es' },
      { file: 'es/co/pageTitles.json', locale: 'es-CO' },
      { file: 'de/pageTitles.json', locale: 'de' }
    ];

    for (const { file, locale } of pageTitleFiles) {
      await this.migratePageTitleFile(file, locale);
    }
  }

  async migratePageTitleFile(filePath, locale) {
    const fullPath = path.join(this.legacyDir, filePath);
    
    try {
      const data = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
      
      const modularData = {
        "$schema": "../../base/metadata-schema.json",
        "$metadata": {
          "component": "pageTitles",
          "lastUpdated": new Date().toISOString(),
          "completeness": 100,
          "context": "Page titles for browser tabs and navigation",
          "migrated": true,
          "originalFormat": "legacy"
        },
        "translations": this.convertTranslations(data)
      };

      const outputPath = path.join(this.newLocalesDir, locale, 'pages/page-titles.json');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(modularData, null, 2));
      
      console.log(`  ✅ Migrated page titles for ${locale}`);
    } catch (error) {
      console.warn(`  ⚠️ Could not migrate page titles for ${locale}: ${error.message}`);
    }
  }

  async generateMigrationReport() {
    console.log('📋 Generating migration report...');
    
    const report = {
      migrationDate: new Date().toISOString(),
      summary: {
        locales: Object.values(LOCALE_MAPPING),
        components: Object.keys(COMPONENT_MAPPING),
        totalFiles: 0,
        successfulMigrations: 0,
        warnings: 0
      },
      files: {}
    };

    // Scan migrated files
    for (const locale of Object.values(LOCALE_MAPPING)) {
      const localeDir = path.join(this.newLocalesDir, locale);
      
      try {
        const files = await this.getAllJsonFiles(localeDir);
        report.files[locale] = files.length;
        report.summary.totalFiles += files.length;
        
        for (const file of files) {
          const content = JSON.parse(await fs.readFile(file, 'utf-8'));
          if (content.$metadata?.migrated) {
            report.summary.successfulMigrations++;
          }
        }
      } catch (error) {
        report.summary.warnings++;
        console.warn(`⚠️ Could not scan ${locale}: ${error.message}`);
      }
    }

    const reportPath = path.join(__dirname, '../reports/migration-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Migration Report:`);
    console.log(`   Total files: ${report.summary.totalFiles}`);
    console.log(`   Successful migrations: ${report.summary.successfulMigrations}`);
    console.log(`   Warnings: ${report.summary.warnings}`);
    console.log(`   Report saved: ${reportPath}`);
  }

  async getAllJsonFiles(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.getAllJsonFiles(fullPath));
        } else if (entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    
    return files;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  const migrator = new TranslationMigrator();

  switch (command) {
    case 'migrate':
      await migrator.migrateAll();
      await migrator.generateMigrationReport();
      break;
      
    case 'report':
      await migrator.generateMigrationReport();
      break;
      
    default:
      console.log(`
Translation Migration Tool

Usage: node migrate-existing.js [command]

Commands:
  migrate             - Migrate all existing translations (default)
  report              - Generate migration report only

Examples:
  node migrate-existing.js                    # Full migration
  node migrate-existing.js report             # Report only
      `);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TranslationMigrator };