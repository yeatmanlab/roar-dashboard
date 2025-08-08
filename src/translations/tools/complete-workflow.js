#!/usr/bin/env node

/**
 * Complete translation workflow: local → Crowdin → build
 * Handles the full cycle of translation management
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Execute command with proper error handling
 */
function runCommand(command, description) {
    console.log(`🔄 ${description}...`);
    try {
        execSync(command, { stdio: 'inherit', cwd: process.cwd() });
        console.log(`✅ ${description} completed\n`);
        return true;
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        return false;
    }
}

/**
 * Check if Crowdin token is available
 */
function checkCrowdinToken() {
    if (!process.env.CROWDIN_API_TOKEN) {
        console.error('❌ CROWDIN_API_TOKEN environment variable not set');
        console.log('   Set your token: export CROWDIN_API_TOKEN="your-token-here"');
        return false;
    }
    return true;
}

/**
 * Upload workflow: local changes → Crowdin
 */
async function uploadWorkflow() {
    console.log('📤 UPLOAD WORKFLOW: Local Changes → Crowdin\n');
    
    if (!checkCrowdinToken()) return false;
    
    const steps = [
        {
            command: 'npm run i18n:consolidate',
            description: 'Consolidate local translations to CSV'
        },
        {
            command: 'npm run i18n:crowdin:upload',
            description: 'Upload source files to Crowdin'
        },
        {
            command: 'npm run i18n:crowdin:upload-translations',
            description: 'Upload existing translations to Crowdin'
        },
        {
            command: 'npm run i18n:crowdin:status',
            description: 'Check Crowdin project status'
        }
    ];
    
    for (const step of steps) {
        if (!runCommand(step.command, step.description)) {
            return false;
        }
    }
    
    console.log('🎉 Upload workflow completed successfully!');
    console.log('   📝 Translators can now work on translations in Crowdin');
    console.log('   🔗 Project: https://crowdin.com/project/levantetranslations');
    return true;
}

/**
 * Download workflow: Crowdin → local build
 */
async function downloadWorkflow() {
    console.log('📥 DOWNLOAD WORKFLOW: Crowdin → Local Build\n');
    
    if (!checkCrowdinToken()) return false;
    
    const steps = [
        {
            command: 'npm run i18n:download-rebuild',
            description: 'Download and rebuild translations from Crowdin'
        },
        {
            command: 'npm run i18n:validate',
            description: 'Validate downloaded translations'
        },
        {
            command: 'npm run i18n:health',
            description: 'Run translation system health check'
        }
    ];
    
    for (const step of steps) {
        if (!runCommand(step.command, step.description)) {
            return false;
        }
    }
    
    console.log('🎉 Download workflow completed successfully!');
    console.log('   ✅ Latest translations integrated into your project');
    return true;
}

/**
 * Full workflow: complete round-trip
 */
async function fullWorkflow() {
    console.log('🔄 FULL WORKFLOW: Complete Translation Round-Trip\n');
    
    console.log('📤 Phase 1: Upload local changes to Crowdin');
    if (!await uploadWorkflow()) {
        return false;
    }
    
    console.log('\n⏳ Phase 2: Waiting for translations...');
    console.log('   💡 Translators should now work on translations in Crowdin');
    console.log('   ⏸️  Press Ctrl+C to stop, or Enter to continue with download...');
    
    // Wait for user input in non-CI environments
    if (!process.env.CI) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        await new Promise(resolve => {
            process.stdin.once('data', () => {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                resolve();
            });
        });
    }
    
    console.log('\n📥 Phase 3: Download completed translations');
    if (!await downloadWorkflow()) {
        return false;
    }
    
    console.log('🎊 Full workflow completed successfully!');
    return true;
}

/**
 * Show workflow help
 */
function showHelp() {
    console.log('🌐 Translation Workflow Commands\n');
    console.log('Available workflows:');
    console.log('  upload    - Upload local changes to Crowdin');
    console.log('  download  - Download completed translations from Crowdin');
    console.log('  full      - Complete round-trip workflow');
    console.log('  help      - Show this help message\n');
    
    console.log('Environment setup:');
    console.log('  export CROWDIN_API_TOKEN="your-token-here"\n');
    
    console.log('Individual commands:');
    console.log('  npm run i18n:consolidate         - Create CSV files');
    console.log('  npm run i18n:crowdin:upload      - Upload sources');
    console.log('  npm run i18n:download-rebuild    - Download & rebuild');
    console.log('  npm run i18n:build-integration   - Build-time integration');
    console.log('  npm run i18n:crowdin:status      - Check project status');
}

/**
 * Main execution
 */
async function main() {
    const workflow = process.argv[2] || 'help';
    
    console.log('🌐 Translation Management Workflow\n');
    
    switch (workflow.toLowerCase()) {
        case 'upload':
            await uploadWorkflow();
            break;
            
        case 'download':
            await downloadWorkflow();
            break;
            
        case 'full':
            await fullWorkflow();
            break;
            
        case 'help':
        default:
            showHelp();
            break;
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Workflow failed:', error.message);
        process.exit(1);
    });
}

export { uploadWorkflow, downloadWorkflow, fullWorkflow };

