#!/usr/bin/env node

/**
 * Build-time integration script for Crowdin translations
 * Automatically downloads and integrates translations during build
 */

import { downloadAndRebuild } from './download-and-rebuild.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSLATIONS_DIR = path.join(__dirname, '..', 'locales');

/**
 * Check if we're in a CI/build environment
 */
function isBuildEnvironment() {
    return !!(
        process.env.CI ||
        process.env.BUILD_ENV ||
        process.env.NODE_ENV === 'production' ||
        process.env.CROWDIN_BUILD === 'true'
    );
}

/**
 * Check if Crowdin API token is available
 */
function hasCrowdinToken() {
    return !!(process.env.CROWDIN_API_TOKEN);
}

/**
 * Check if translations directory exists and has content
 */
function hasExistingTranslations() {
    if (!fs.existsSync(TRANSLATIONS_DIR)) return false;
    
    try {
        const languages = fs.readdirSync(TRANSLATIONS_DIR);
        return languages.length > 0;
    } catch {
        return false;
    }
}

/**
 * Create fallback translations if Crowdin is unavailable
 */
function createFallbackTranslations() {
    console.log('🔄 Creating fallback translations...');
    
    const fallbackDir = path.join(TRANSLATIONS_DIR, 'en');
    if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
        
        // Create minimal English fallback
        const fallbackComponent = {
            "$schema": "../../base/metadata-schema.json",
            "$metadata": {
                "component": "fallback",
                "lastUpdated": new Date().toISOString(),
                "completeness": 100,
                "context": "Fallback translations",
                "source": "fallback"
            },
            "translations": {
                "fallback": {
                    "value": "Translation unavailable",
                    "context": "Fallback message"
                }
            }
        };
        
        const authDir = path.join(fallbackDir, 'auth');
        fs.mkdirSync(authDir, { recursive: true });
        fs.writeFileSync(
            path.join(authDir, 'fallback.json'),
            JSON.stringify(fallbackComponent, null, 2) + '\n'
        );
        
        console.log('   ✅ Created minimal fallback translations');
    }
}

/**
 * Main build integration
 */
async function main() {
    console.log('🏗️  Translation Build Integration\n');
    
    const isBuild = isBuildEnvironment();
    const hasToken = hasCrowdinToken();
    const hasTranslations = hasExistingTranslations();
    
    console.log(`   Build Environment: ${isBuild ? '✅' : '❌'}`);
    console.log(`   Crowdin Token: ${hasToken ? '✅' : '❌'}`);
    console.log(`   Existing Translations: ${hasTranslations ? '✅' : '❌'}\n`);
    
    // Strategy 1: Full Crowdin integration (ideal)
    if (hasToken) {
        console.log('🌐 Full Crowdin integration available');
        try {
            await downloadAndRebuild();
            console.log('✅ Translations updated from Crowdin');
            return;
        } catch (error) {
            console.warn('⚠️  Crowdin download failed, falling back...', error.message);
        }
    }
    
    // Strategy 2: Use existing translations (development)
    if (hasTranslations) {
        console.log('📁 Using existing local translations');
        console.log('   💡 Tip: Set CROWDIN_API_TOKEN to enable live updates');
        return;
    }
    
    // Strategy 3: Create fallback (last resort)
    console.log('🔄 No translations available, creating fallback');
    createFallbackTranslations();
    
    console.log('\n📚 Translation integration strategies:');
    console.log('   1. Production: Set CROWDIN_API_TOKEN for live updates');
    console.log('   2. Development: Use npm run i18n:crowdin:download');
    console.log('   3. Offline: Translations committed to git will be used');
}

// Handle different execution contexts
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Build integration failed:', error.message);
        process.exit(1);
    });
}

export { main as buildIntegration };

