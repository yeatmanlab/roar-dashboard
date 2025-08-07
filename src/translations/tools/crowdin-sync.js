#!/usr/bin/env node

/**
 * Crowdin Synchronization Tool
 * Handles upload/download of translations to/from Crowdin
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

class CrowdinSyncManager {
  constructor() {
    this.crowdinConfigPath = path.join(__dirname, '../crowdin/crowdin.yml');
    this.backupDir = path.join(__dirname, '../backups');
  }

  async checkCrowdinCLI() {
    try {
      await execAsync('crowdin --version');
      console.log('✅ Crowdin CLI detected');
    } catch (error) {
      console.error('❌ Crowdin CLI not found. Please install: npm install -g @crowdin/cli');
      console.error('   Or download from: https://support.crowdin.com/cli-tool/');
      process.exit(1);
    }
  }

  async checkEnvironment() {
    if (!process.env.CROWDIN_API_TOKEN) {
      console.error('❌ CROWDIN_API_TOKEN environment variable not set');
      console.error('   Get your token from: https://crowdin.com/settings#api-key');
      process.exit(1);
    }
    console.log('✅ Crowdin API token found');
  }

  async createBackup() {
    console.log('💾 Creating backup of current translations...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, \`backup-\${timestamp}\`);
    
    await fs.mkdir(backupPath, { recursive: true });
    
    // Copy current translations
    const localesDir = path.join(__dirname, '../locales');
    await this.copyDirectory(localesDir, path.join(backupPath, 'locales'));
    
    console.log(\`✅ Backup created: \${backupPath}\`);
    return backupPath;
  }

  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async uploadSources() {
    console.log('⬆️ Uploading source files to Crowdin...');
    
    try {
      const { stdout, stderr } = await execAsync(
        \`crowdin upload sources --config "\${this.crowdinConfigPath}" --verbose\`,
        { cwd: projectRoot }
      );
      
      console.log('📤 Upload output:', stdout);
      if (stderr) console.warn('⚠️ Upload warnings:', stderr);
      
      console.log('✅ Sources uploaded successfully');
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }

  async uploadTranslations() {
    console.log('⬆️ Uploading existing translations to Crowdin...');
    
    try {
      const { stdout, stderr } = await execAsync(
        \`crowdin upload translations --config "\${this.crowdinConfigPath}" --verbose\`,
        { cwd: projectRoot }
      );
      
      console.log('📤 Translation upload output:', stdout);
      if (stderr) console.warn('⚠️ Translation upload warnings:', stderr);
      
      console.log('✅ Existing translations uploaded as seed data');
    } catch (error) {
      console.error('❌ Translation upload failed:', error.message);
      throw error;
    }
  }

  async downloadTranslations() {
    console.log('⬇️ Downloading translations from Crowdin...');
    
    const backupPath = await this.createBackup();
    
    try {
      const { stdout, stderr } = await execAsync(
        \`crowdin download --config "\${this.crowdinConfigPath}" --verbose\`,
        { cwd: projectRoot }
      );
      
      console.log('📥 Download output:', stdout);
      if (stderr) console.warn('⚠️ Download warnings:', stderr);
      
      console.log('✅ Translations downloaded successfully');
      await this.updateMetadata();
      
    } catch (error) {
      console.error('❌ Download failed:', error.message);
      console.log(\`🔄 Restoring from backup: \${backupPath}\`);
      await this.restoreFromBackup(backupPath);
      throw error;
    }
  }

  async restoreFromBackup(backupPath) {
    const localesDir = path.join(__dirname, '../locales');
    await fs.rm(localesDir, { recursive: true, force: true });
    await this.copyDirectory(path.join(backupPath, 'locales'), localesDir);
    console.log('✅ Restored from backup');
  }

  async updateMetadata() {
    console.log('🔄 Updating translation metadata...');
    
    const localesDir = path.join(__dirname, '../locales');
    const locales = await fs.readdir(localesDir);
    
    for (const locale of locales) {
      if (locale === 'en') continue; // Skip source locale
      
      const localeDir = path.join(localesDir, locale);
      const files = await this.getTranslationFiles(localeDir);
      
      for (const file of files) {
        await this.updateFileMetadata(file, locale);
      }
    }
    
    console.log('✅ Metadata updated');
  }

  async getTranslationFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.getTranslationFiles(fullPath));
      } else if (entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async updateFileMetadata(filePath, locale) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.$metadata) {
        data.$metadata.lastUpdated = new Date().toISOString();
        data.$metadata.source = 'crowdin';
        data.$metadata.locale = locale;
        
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.warn(\`⚠️ Could not update metadata for \${filePath}: \${error.message}\`);
    }
  }

  async checkTranslationStatus() {
    console.log('📊 Checking translation status...');
    
    try {
      const { stdout } = await execAsync(
        \`crowdin status --config "\${this.crowdinConfigPath}"\`,
        { cwd: projectRoot }
      );
      
      console.log('📋 Translation Status:');
      console.log(stdout);
      
      return this.parseStatusOutput(stdout);
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      throw error;
    }
  }

  parseStatusOutput(output) {
    const lines = output.split('\\n');
    const status = {};
    
    lines.forEach(line => {
      const match = line.match(/([a-z-]+)\\s+(\\d+)%/);
      if (match) {
        status[match[1]] = parseInt(match[2]);
      }
    });
    
    return status;
  }

  async generateProgressReport() {
    console.log('📈 Generating progress report...');
    
    const status = await this.checkTranslationStatus();
    const reportDir = path.join(__dirname, '../reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const report = {
      generatedAt: new Date().toISOString(),
      translationStatus: status,
      summary: {
        totalLanguages: Object.keys(status).length,
        averageCompletion: Math.round(
          Object.values(status).reduce((sum, val) => sum + val, 0) / Object.keys(status).length
        ),
        fullyCompleted: Object.values(status).filter(val => val === 100).length,
        needsAttention: Object.entries(status).filter(([_, val]) => val < 80)
      }
    };
    
    const reportPath = path.join(reportDir, 'crowdin-progress.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('✅ Progress report generated:', reportPath);
    console.log(\`   Average completion: \${report.summary.averageCompletion}%\`);
    console.log(\`   Fully completed: \${report.summary.fullyCompleted} languages\`);
    
    if (report.summary.needsAttention.length > 0) {
      console.log('⚠️ Languages needing attention:');
      report.summary.needsAttention.forEach(([lang, completion]) => {
        console.log(\`   - \${lang}: \${completion}%\`);
      });
    }
    
    return report;
  }

  async syncGlossary() {
    console.log('📚 Syncing glossary with Crowdin...');
    
    const glossaryPath = path.join(__dirname, '../crowdin/glossary.csv');
    
    try {
      await execAsync(
        \`crowdin glossary upload --file "\${glossaryPath}" --config "\${this.crowdinConfigPath}"\`,
        { cwd: projectRoot }
      );
      
      console.log('✅ Glossary synced successfully');
    } catch (error) {
      console.warn(\`⚠️ Glossary sync failed: \${error.message}\`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options = {
    force: args.includes('--force'),
    backup: args.includes('--backup'),
    verbose: args.includes('--verbose')
  };

  const syncManager = new CrowdinSyncManager();

  try {
    await syncManager.checkCrowdinCLI();
    await syncManager.checkEnvironment();

    switch (command) {
      case 'upload':
        await syncManager.uploadSources();
        break;
        
      case 'upload-translations':
        await syncManager.uploadTranslations();
        break;
        
      case 'download':
        await syncManager.downloadTranslations();
        break;
        
      case 'status':
        await syncManager.checkTranslationStatus();
        break;
        
      case 'report':
        await syncManager.generateProgressReport();
        break;
        
      case 'sync-all':
        console.log('🚀 Starting full synchronization...');
        await syncManager.uploadSources();
        await syncManager.uploadTranslations();
        await syncManager.syncGlossary();
        await syncManager.generateProgressReport();
        console.log('✅ Full sync completed');
        break;
        
      case 'init':
        console.log('🎯 Initializing Crowdin with existing translations...');
        await syncManager.uploadSources();
        await syncManager.uploadTranslations();
        await syncManager.syncGlossary();
        console.log('✅ Crowdin initialized with seed data');
        break;
        
      default:
        console.log(\`
Crowdin Sync Tool

Usage: node crowdin-sync.js [command] [options]

Commands:
  upload              - Upload source files to Crowdin
  upload-translations - Upload existing translations as seed data
  download            - Download completed translations
  status              - Check translation progress
  report              - Generate progress report
  sync-all            - Full synchronization (upload + download)
  init                - Initialize Crowdin with existing translations
  
Options:
  --force             - Force operation even with warnings
  --backup            - Create backup before download
  --verbose           - Verbose output

Environment Variables:
  CROWDIN_API_TOKEN   - Your Crowdin API token (required)

Examples:
  node crowdin-sync.js init                    # First-time setup
  node crowdin-sync.js upload                  # Upload source files
  node crowdin-sync.js download --backup       # Download with backup
  node crowdin-sync.js sync-all                # Complete sync cycle
        \`);
    }
  } catch (error) {
    console.error(\`❌ Operation failed: \${error.message}\`);
    process.exit(1);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main();
}

export { CrowdinSyncManager };