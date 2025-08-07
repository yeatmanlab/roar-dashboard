#!/usr/bin/env node

/**
 * Creates consolidated translation files with all languages in a single CSV
 * Format: identifier, label, en, es-CO, de
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSLATIONS_DIR = path.join(__dirname, '..', 'locales');
const OUTPUT_DIR = path.join(__dirname, '..', 'consolidated');

// Language mappings
const LANGUAGES = {
    'en': 'en',
    'es': 'es-CO', 
    'de': 'de'
};

// Component types to process
const COMPONENT_TYPES = ['auth', 'components', 'pages', 'surveys'];

/**
 * Read and parse a JSON translation file
 */
function readTranslationFile(language, type, filename) {
    const filePath = path.join(TRANSLATIONS_DIR, language, type, filename);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Missing: ${filePath}`);
        return null;
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        return data.translations || {};
    } catch (error) {
        console.error(`❌ Error reading ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Get all translation files for a component type
 */
function getTranslationFiles(type) {
    const enDir = path.join(TRANSLATIONS_DIR, 'en', type);
    if (!fs.existsSync(enDir)) {
        return [];
    }
    
    return fs.readdirSync(enDir)
        .filter(file => file.endsWith('.json'))
        .sort();
}

/**
 * Convert translations to consolidated CSV format
 */
function createConsolidatedCSV(type) {
    console.log(`\n📁 Processing ${type} translations...`);
    
    const files = getTranslationFiles(type);
    if (files.length === 0) {
        console.log(`  No files found for ${type}`);
        return;
    }
    
    const rows = [];
    
    // CSV header
    rows.push(['identifier', 'label', 'en', 'es-CO', 'de']);
    
    // Process each file
    for (const filename of files) {
        const componentName = filename.replace('.json', '');
        console.log(`  📄 Processing ${filename}...`);
        
        // Load translations for all languages
        const translations = {};
        for (const [lang, code] of Object.entries(LANGUAGES)) {
            translations[code] = readTranslationFile(lang, type, filename);
        }
        
        // Get all unique translation keys from English (master)
        const enTranslations = translations['en'];
        if (!enTranslations) {
            console.log(`    ⚠️  No English translations found for ${filename}`);
            continue;
        }
        
        const keys = Object.keys(enTranslations);
        console.log(`    📝 Found ${keys.length} translation keys`);
        
        // Create rows for each translation key
        for (const key of keys) {
            const identifier = `${type}.${componentName}.${key}`;
            const label = `${type}/${componentName}`;
            
            const enValue = enTranslations[key]?.value || '';
            const esValue = translations['es-CO']?.[key]?.value || '';
            const deValue = translations['de']?.[key]?.value || '';
            
            // Skip separator lines and empty values
            if (key.includes('LEVANTE TRANSLATIONS') || !enValue.trim()) {
                continue;
            }
            
            rows.push([
                identifier,
                label,
                enValue,
                esValue,
                deValue
            ]);
        }
    }
    
    return rows;
}

/**
 * Write CSV data to file
 */
function writeCSV(filename, rows) {
    const csvContent = rows.map(row => 
        row.map(cell => {
            // Escape quotes and wrap in quotes if needed
            const escaped = String(cell || '').replace(/"/g, '""');
            if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
                return `"${escaped}"`;
            }
            return escaped;
        }).join(',')
    ).join('\n');
    
    const outputPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputPath, csvContent, 'utf8');
    console.log(`✅ Written: ${outputPath} (${rows.length - 1} translations)`);
    
    return outputPath;
}

/**
 * Create metadata file for Crowdin context
 */
function createMetadata() {
    const metadata = {
        project: "Levante Dashboard Translations",
        created: new Date().toISOString(),
        description: "Consolidated translation files with all languages in single CSV format",
        format: "CSV with columns: identifier, label, en, es-CO, de",
        languages: Object.values(LANGUAGES),
        componentTypes: COMPONENT_TYPES,
        note: "Generated automatically from modular JSON translation files"
    };
    
    const metadataPath = path.join(OUTPUT_DIR, 'translation-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`✅ Metadata: ${metadataPath}`);
}

/**
 * Main execution
 */
function main() {
    console.log('🌐 Creating Consolidated Translation Files...\n');
    
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
    }
    
    let totalTranslations = 0;
    
    // Process each component type
    for (const type of COMPONENT_TYPES) {
        const rows = createConsolidatedCSV(type);
        if (rows && rows.length > 1) {
            const filename = `dashboard-${type}-translations.csv`;
            writeCSV(filename, rows);
            totalTranslations += rows.length - 1; // subtract header row
        }
    }
    
    // Create one master file with all translations
    console.log(`\n📋 Creating master consolidated file...`);
    const allRows = [['identifier', 'label', 'en', 'es-CO', 'de']];
    
    for (const type of COMPONENT_TYPES) {
        const typeRows = createConsolidatedCSV(type);
        if (typeRows && typeRows.length > 1) {
            // Add all rows except header
            allRows.push(...typeRows.slice(1));
        }
    }
    
    if (allRows.length > 1) {
        writeCSV('dashboard-all-translations.csv', allRows);
    }
    
    // Create metadata
    createMetadata();
    
    console.log(`\n🎉 Consolidation complete!`);
    console.log(`   📊 Total translations: ${totalTranslations}`);
    console.log(`   📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`   📄 Files created:`);
    
    const files = fs.readdirSync(OUTPUT_DIR);
    files.forEach(file => {
        console.log(`      - ${file}`);
    });
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
