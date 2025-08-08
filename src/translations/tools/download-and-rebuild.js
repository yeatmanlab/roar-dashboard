#!/usr/bin/env node

/**
 * Downloads translations from Crowdin and rebuilds modular JSON files
 * Supports automatic detection of new languages
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSLATIONS_DIR = path.join(__dirname, '..', 'locales');
const CROWDIN_CONFIG = path.join(__dirname, '..', 'crowdin', 'crowdin.yml');
const COMPONENT_MANIFEST = path.join(__dirname, '..', 'base', 'component-manifest.json');

/**
 * Download all translations from Crowdin
 */
async function downloadFromCrowdin() {
    console.log('📥 Downloading translations from Crowdin...');
    
      try {
    // Download all translations directly to project structure
    const cmd = `crowdin download --config "${CROWDIN_CONFIG}" --export-only-approved=false`;
    console.log(`   Running: ${cmd}`);
    
    execSync(cmd, { 
      stdio: 'inherit',
      cwd: path.dirname(CROWDIN_CONFIG)
    });
    
    console.log('✅ Download completed');
    return true;
  } catch (error) {
    console.error('❌ Download failed:', error.message);
    return false;
  }
}

/**
 * Parse CSV content into structured data
 */
function parseCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const rows = lines.slice(1).map(line => {
        // Handle CSV parsing with quoted fields
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        return values;
    });
    
    return { headers, rows };
}

/**
 * Get available languages from downloaded files
 */
function detectAvailableLanguages() {
    console.log('🔍 Detecting available languages...');
    
    const languages = new Set(['en']); // Always include English
    
    // Check what CSV files were downloaded
    const csvFiles = [
        'consolidated/dashboard-all-translations.csv',
        'consolidated/dashboard-auth-translations.csv',
        'consolidated/dashboard-components-translations.csv',
        'consolidated/dashboard-pages-translations.csv',
        'consolidated/dashboard-surveys-translations.csv'
    ];
    
      for (const csvFile of csvFiles) {
    const filePath = path.join(__dirname, '..', csvFile);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const { headers } = parseCSV(content);
      
      // Extract language codes from headers (skip identifier and context columns)
      headers.slice(2).forEach(header => {
        const lang = header.toLowerCase().trim();
        if (lang && lang !== 'en') {
          languages.add(lang);
        }
      });
      break; // Only need to check one file for headers
    }
  }
    
    const detectedLanguages = Array.from(languages);
    console.log(`   Found languages: ${detectedLanguages.join(', ')}`);
    
    return detectedLanguages;
}

/**
 * Convert CSV row to translation object
 */
function rowToTranslation(headers, row, languageCode) {
    const identifier = row[0];
    const context = row[1];
    
    // Find the column index for this language
    const langIndex = headers.findIndex(h => h.toLowerCase().trim() === languageCode.toLowerCase());
    if (langIndex === -1) return null;
    
    const translation = row[langIndex];
    // Return empty translation for missing/empty values (instead of null)
    const cleanTranslation = translation ? translation.replace(/"/g, '').trim() : '';
    
    return {
        identifier,
        context,
        translation: cleanTranslation
    };
}

/**
 * Rebuild modular JSON files from CSV data
 */
function rebuildModularFiles(languages) {
    console.log('🔧 Rebuilding modular JSON files...');
    
    // Load component manifest
    const manifest = JSON.parse(fs.readFileSync(COMPONENT_MANIFEST, 'utf8'));
    
    // Process each CSV file
    const csvFiles = {
        'consolidated/dashboard-auth-translations.csv': 'auth',
        'consolidated/dashboard-components-translations.csv': 'components', 
        'consolidated/dashboard-pages-translations.csv': 'pages',
        'consolidated/dashboard-surveys-translations.csv': 'surveys'
    };
    
    const translationData = {};
    
    // Initialize language data structure
    languages.forEach(lang => {
        translationData[lang] = {};
    });
    
      // Process each CSV file
  for (const [csvFile, category] of Object.entries(csvFiles)) {
    const filePath = path.join(__dirname, '..', csvFile);
    if (!fs.existsSync(filePath)) {
      console.log(`   ⚠️  Skipping missing file: ${csvFile}`);
      continue;
    }
        
        console.log(`   📄 Processing ${csvFile}...`);
        const content = fs.readFileSync(filePath, 'utf8');
        const { headers, rows } = parseCSV(content);
        
        // Process each row
        rows.forEach(row => {
            if (row.length < 3) return; // Skip invalid rows
            
            const identifier = row[0];
            if (!identifier || identifier.includes('LEVANTE TRANSLATIONS')) return;
            
            // Parse identifier: category.component.key
            const parts = identifier.split('.');
            if (parts.length < 3) return;
            
            const [cat, component, key] = parts;
            
            // Process each language
            languages.forEach(lang => {
                const translation = rowToTranslation(headers, row, lang);
                if (!translation) return; // Only skip if language column doesn't exist
                
                // Initialize nested structure
                if (!translationData[lang][category]) {
                    translationData[lang][category] = {};
                }
                if (!translationData[lang][category][component]) {
                    translationData[lang][category][component] = {
                        $schema: "../../base/metadata-schema.json",
                        $metadata: {
                            component: component,
                            lastUpdated: new Date().toISOString(),
                            completeness: 0,
                            context: `${category} component`,
                            source: "crowdin"
                        },
                        translations: {}
                    };
                }
                
                // Add translation
                translationData[lang][category][component].translations[key] = {
                    value: translation.translation,
                    context: translation.context || "General text"
                };
            });
        });
    }
    
    // Ensure all languages have basic structure even if no translations
    console.log('📁 Ensuring directory structure for all languages...');
    const basicComponents = {
        'auth': ['consent', 'signin'],
        'components': ['game-tabs', 'navbar', 'participant-sidebar', 'sentry-form', 'tasks'],
        'pages': ['home-participant', 'home-selector', 'not-found', 'page-titles', 'signin'],
        'surveys': ['user-survey']
    };
    
    languages.forEach(lang => {
        if (!translationData[lang]) {
            translationData[lang] = {};
        }
        
        // Create basic component structure for languages without translations
        Object.entries(basicComponents).forEach(([category, components]) => {
            if (!translationData[lang][category]) {
                translationData[lang][category] = {};
            }
            
            components.forEach(component => {
                if (!translationData[lang][category][component]) {
                    translationData[lang][category][component] = {
                        $schema: "../../base/metadata-schema.json",
                        $metadata: {
                            component: component,
                            lastUpdated: new Date().toISOString(),
                            completeness: 0,
                            context: `${category} component`,
                            source: "crowdin"
                        },
                        translations: {}
                    };
                }
            });
        });
    });

    // Write JSON files
    console.log('💾 Writing modular JSON files...');
    
    languages.forEach(lang => {
        const langDir = path.join(TRANSLATIONS_DIR, lang);
        
        // Create language directory
        if (!fs.existsSync(langDir)) {
            fs.mkdirSync(langDir, { recursive: true });
            console.log(`   📁 Created directory: ${lang}/`);
        }
        
        // Write each category/component
        Object.entries(translationData[lang]).forEach(([category, components]) => {
            const categoryDir = path.join(langDir, category);
            if (!fs.existsSync(categoryDir)) {
                fs.mkdirSync(categoryDir, { recursive: true });
            }
            
            Object.entries(components).forEach(([component, data]) => {
                // Calculate completeness
                const translationCount = Object.keys(data.translations).length;
                data.$metadata.completeness = translationCount > 0 ? 100 : 0;
                
                const filePath = path.join(categoryDir, `${component}.json`);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
                
                console.log(`   ✅ ${lang}/${category}/${component}.json (${translationCount} translations)`);
            });
        });
    });
}

/**
 * Update component manifest with new languages
 */
function updateComponentManifest(languages) {
    console.log('📝 Updating component manifest...');
    
    const manifest = JSON.parse(fs.readFileSync(COMPONENT_MANIFEST, 'utf8'));
    
    // Update supported languages
    manifest.supportedLanguages = languages.sort();
    manifest.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(COMPONENT_MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`   ✅ Updated manifest with languages: ${languages.join(', ')}`);
}

/**
 * Clean up temporary files
 */
function cleanup() {
    console.log('🧹 Cleaning up...');
    console.log('   ✅ No cleanup needed (working with project files directly)');
}

/**
 * Main execution
 */
async function main() {
    console.log('🌐 Crowdin Translation Download & Rebuild\n');
    
    try {
        // Step 1: Download from Crowdin
        const downloadSuccess = await downloadFromCrowdin();
        if (!downloadSuccess) {
            throw new Error('Failed to download from Crowdin');
        }
        
        // Step 2: Detect available languages
        const languages = detectAvailableLanguages();
        if (languages.length === 0) {
            throw new Error('No languages detected in downloaded files');
        }
        
        // Step 3: Rebuild modular files
        rebuildModularFiles(languages);
        
        // Step 4: Update manifest
        updateComponentManifest(languages);
        
        // Step 5: Cleanup
        cleanup();
        
        console.log('\n🎉 Translation rebuild completed successfully!');
        console.log(`   📊 Processed ${languages.length} languages: ${languages.join(', ')}`);
        console.log(`   📁 Updated files in: ${TRANSLATIONS_DIR}`);
        
    } catch (error) {
        console.error('\n❌ Translation rebuild failed:', error.message);
        cleanup();
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { main as downloadAndRebuild };
