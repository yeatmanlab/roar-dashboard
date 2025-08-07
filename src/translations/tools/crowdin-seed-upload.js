#!/usr/bin/env node

/**
 * Crowdin Seed Upload Tool
 * Uploads existing translations to levantetranslations project as initial seed data
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CrowdinSeedUploader {
  constructor() {
    this.translationsDir = path.join(__dirname, '..');
    this.crowdinConfig = path.join(__dirname, '../crowdin/crowdin.yml');
  }

  async uploadSeedTranslations() {
    console.log('🌱 Starting seed upload to levantetranslations project...\n');
    
    try {
      // First, validate our environment
      await this.validateEnvironment();
      
      // Upload source files (English) first
      console.log('📤 Uploading English source files...');
      await this.uploadSources();
      
      // Then upload existing translations as seed data
      console.log('📤 Uploading existing translation files as seed...');
      await this.uploadTranslations();
      
      // Generate upload report
      await this.generateUploadReport();
      
      console.log('\n✅ Seed upload completed successfully!');
      console.log('🔗 Check your Crowdin project: https://crowdin.com/project/levantetranslations');
      
    } catch (error) {
      console.error('\n❌ Seed upload failed:', error.message);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    console.log('🔍 Validating environment...');
    
    // Check if CROWDIN_API_TOKEN is set
    if (!process.env.CROWDIN_API_TOKEN) {
      throw new Error('CROWDIN_API_TOKEN environment variable is not set');
    }
    
    // Check if crowdin CLI is available
    try {
      await execAsync('crowdin --version');
      console.log('✅ Crowdin CLI is available');
    } catch (error) {
      throw new Error('Crowdin CLI is not installed. Run: npm install -g @crowdin/cli');
    }
    
    // Check if config file exists
    try {
      await fs.access(this.crowdinConfig);
      console.log('✅ Crowdin config file found');
    } catch (error) {
      throw new Error(`Crowdin config file not found: ${this.crowdinConfig}`);
    }
    
    // Check if translations directory exists
    try {
      await fs.access(this.translationsDir);
      console.log('✅ Translations directory found');
    } catch (error) {
      throw new Error(`Translations directory not found: ${this.translationsDir}`);
    }
  }

  async uploadSources() {
    try {
      const { stdout, stderr } = await execAsync(`crowdin upload sources --config "${this.crowdinConfig}" --verbose`);
      console.log('📁 Source files uploaded:');
      console.log(stdout);
      
      if (stderr) {
        console.warn('⚠️ Warnings during source upload:');
        console.warn(stderr);
      }
    } catch (error) {
      console.error('❌ Failed to upload source files:', error.message);
      throw error;
    }
  }

  async uploadTranslations() {
    const languages = ['es', 'de', 'es-CO', 'en-US'];
    
    for (const lang of languages) {
      console.log(`\n📤 Uploading translations for ${lang}...`);
      
      try {
        const { stdout, stderr } = await execAsync(
          `crowdin upload translations --config "${this.crowdinConfig}" --language ${lang} --verbose`
        );
        
        console.log(`✅ ${lang} translations uploaded`);
        if (stdout) console.log(stdout);
        
        if (stderr) {
          console.warn(`⚠️ Warnings for ${lang}:`);
          console.warn(stderr);
        }
      } catch (error) {
        console.error(`❌ Failed to upload ${lang} translations:`, error.message);
        // Continue with other languages instead of failing completely
      }
    }
  }

  async generateUploadReport() {
    console.log('\n📊 Generating upload report...');
    
    try {
      const { stdout } = await execAsync(`crowdin status --config "${this.crowdinConfig}"`);
      
      const reportData = {
        uploadDate: new Date().toISOString(),
        project: 'levantetranslations',
        uploadedFiles: this.getUploadedFiles(stdout),
        status: stdout
      };
      
      const reportPath = path.join(this.translationsDir, 'reports', 'seed-upload-report.json');
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
      
      console.log(`📋 Upload report saved: ${reportPath}`);
      
      // Also show current status
      console.log('\n📈 Current project status:');
      console.log(stdout);
      
    } catch (error) {
      console.warn('⚠️ Could not generate upload report:', error.message);
    }
  }

  getUploadedFiles(statusOutput) {
    // Parse the status output to extract file information
    const lines = statusOutput.split('\n');
    const files = [];
    
    for (const line of lines) {
      if (line.includes('.json') || line.includes('.csv')) {
        files.push(line.trim());
      }
    }
    
    return files;
  }

  async prepareLegacyFiles() {
    console.log('📦 Preparing legacy files for upload...');
    
    const legacyFiles = [
      'en/en-componentTranslations.json',
      'es/es-componentTranslations.json', 
      'de/de-componentTranslations.json'
    ];
    
    for (const file of legacyFiles) {
      const sourcePath = path.join(this.translationsDir, file);
      const destPath = path.join(this.translationsDir, 'legacy', path.basename(file).replace(/^[a-z]{2}-/, ''));
      
      try {
        await fs.access(sourcePath);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);
        console.log(`✅ Prepared: ${path.basename(file)}`);
      } catch (error) {
        console.warn(`⚠️ Could not prepare ${file}: ${error.message}`);
      }
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const uploader = new CrowdinSeedUploader();
  uploader.uploadSeedTranslations().catch(console.error);
}

export { CrowdinSeedUploader };
