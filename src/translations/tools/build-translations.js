#!/usr/bin/env node

/**
 * Translation Build Tool
 * Compiles modular translations into production-ready format
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

const SUPPORTED_LOCALES = ['en', 'es', 'de', 'es-CO', 'en-US'];

class TranslationBuilder {
  constructor() {
    this.outputDir = path.join(__dirname, '../dist');
    this.legacyDir = path.join(__dirname, '../legacy');
  }

  async buildAll() {
    console.log('🏗️ Building translations for production...');
    
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.legacyDir, { recursive: true });
    
    for (const locale of SUPPORTED_LOCALES) {
      await this.buildLocale(locale);
    }
    
    await this.generateExports();
    await this.generateManifest();
    
    console.log('✅ Build completed successfully');
  }

  async buildLocale(locale) {
    console.log(`📦 Building locale: ${locale}`);
    
    const localeDir = path.join(__dirname, '../locales', locale);
    
    try {
      await fs.access(localeDir);
    } catch {
      console.warn(`⚠️ Locale directory not found: ${locale}`);
      return;
    }

    // Build modular format
    const modularTranslations = await this.buildModularFormat(locale);
    const modularOutputPath = path.join(this.outputDir, `${locale}.json`);
    await fs.writeFile(modularOutputPath, JSON.stringify(modularTranslations, null, 2));

    // Build legacy flat format
    const flatTranslations = this.flattenTranslations(modularTranslations);
    const legacyOutputPath = path.join(this.legacyDir, `${locale}-componentTranslations.json`);
    await fs.writeFile(legacyOutputPath, JSON.stringify(flatTranslations, null, 2));

    console.log(`   ✅ ${locale}: modular (${modularOutputPath}) + legacy (${legacyOutputPath})`);
  }

  async buildModularFormat(locale) {
    const localeDir = path.join(__dirname, '../locales', locale);
    const translationFiles = await glob('**/*.json', { cwd: localeDir });
    
    const result = {
      $metadata: {
        locale,
        buildTime: new Date().toISOString(),
        version: await this.getVersion(),
        files: translationFiles.length
      },
      translations: {}
    };

    for (const file of translationFiles) {
      const filePath = path.join(localeDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      const component = this.getComponentName(file, data);
      
      if (data.translations) {
        // New format with metadata
        result.translations[component] = {
          ...data.translations,
          $meta: {
            file,
            lastUpdated: data.$metadata?.lastUpdated,
            completeness: data.$metadata?.completeness
          }
        };
      } else {
        // Legacy format
        result.translations[component] = {
          ...data,
          $meta: {
            file,
            format: 'legacy'
          }
        };
      }
    }

    return result;
  }

  getComponentName(filePath, data) {
    // Try to get component name from metadata first
    if (data.$metadata?.component) {
      return data.$metadata.component;
    }
    
    // Fall back to inferring from file path
    const relativePath = filePath.replace(/\\.json$/, '');
    const parts = relativePath.split('/');
    
    if (parts.length > 1) {
      // nested: auth/signin.json -> authSignIn
      const category = parts[0];
      const component = parts[1];
      return category + component.charAt(0).toUpperCase() + component.slice(1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    } else {
      // flat: signin.json -> signin
      return parts[0].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
  }

  flattenTranslations(modularData) {
    const result = {};
    
    for (const [component, translations] of Object.entries(modularData.translations)) {
      const flattened = this.flattenObject(translations, '');
      
      // Remove metadata from flattened output
      const filtered = {};
      for (const [key, value] of Object.entries(flattened)) {
        if (!key.startsWith('$meta')) {
          filtered[key] = value;
        }
      }
      
      result[component] = filtered;
    }
    
    return result;
  }

  flattenObject(obj, prefix) {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.value !== undefined) {
          // New format: { value: "text", context: "..." }
          result[newKey] = value.value;
        } else if (key.startsWith('$')) {
          // Metadata - include as-is
          result[key] = value;
        } else {
          // Nested object
          Object.assign(result, this.flattenObject(value, newKey));
        }
      } else {
        // Primitive value
        result[newKey] = value;
      }
    }
    
    return result;
  }

  async generateExports() {
    console.log('📄 Generating TypeScript exports...');
    
    const exportsContent = `// Auto-generated translation exports
// Built on: ${new Date().toISOString()}

// Modular format (recommended)
${SUPPORTED_LOCALES.map(locale => 
  `export { default as ${locale}Translations } from './dist/${locale}.json';`
).join('\n')}

// Legacy format (for backward compatibility)
${SUPPORTED_LOCALES.map(locale => 
  `export { default as ${locale}LegacyTranslations } from './legacy/${locale}-componentTranslations.json';`
).join('\n')}

// Type definitions
export interface TranslationMetadata {
  locale: string;
  buildTime: string;
  version: string;
  files: number;
}

export interface ComponentTranslations {
  [key: string]: any;
  $meta?: {
    file: string;
    lastUpdated?: string;
    completeness?: number;
    format?: string;
  };
}

export interface ModularTranslations {
  $metadata: TranslationMetadata;
  translations: {
    [component: string]: ComponentTranslations;
  };
}

// Supported locales
export const SUPPORTED_LOCALES = ${JSON.stringify(SUPPORTED_LOCALES)};

// Locale metadata
export const LOCALE_METADATA = {
${SUPPORTED_LOCALES.map(locale => {
  const isRegional = locale.includes('-');
  const baseLocale = isRegional ? locale.split('-')[0] : locale;
  const region = isRegional ? locale.split('-')[1] : null;
  
  const languageNames = {
    'en': 'English',
    'es': 'Español',
    'de': 'Deutsch'
  };
  
  const regionNames = {
    'US': 'United States',
    'CO': 'Colombia'
  };
  
  const displayName = languageNames[baseLocale] + (region ? ` (${regionNames[region] || region})` : '');
  
  return `  '${locale}': {
    code: '${locale}',
    name: '${displayName}',
    baseLanguage: '${baseLocale}',
    region: ${region ? `'${region}'` : 'null'},
    isRegional: ${isRegional}
  }`;
}).join(',\n')}
};
`;

    const exportsPath = path.join(__dirname, '../exports.ts');
    await fs.writeFile(exportsPath, exportsContent);
    
    console.log(`   ✅ Exports generated: ${exportsPath}`);
  }

  async generateManifest() {
    console.log('📋 Generating build manifest...');
    
    const manifest = {
      buildTime: new Date().toISOString(),
      version: await this.getVersion(),
      locales: SUPPORTED_LOCALES,
      files: {},
      statistics: {
        totalLocales: SUPPORTED_LOCALES.length,
        totalFiles: 0,
        totalKeys: 0
      }
    };

    // Collect file statistics
    for (const locale of SUPPORTED_LOCALES) {
      const modularPath = path.join(this.outputDir, `${locale}.json`);
      const legacyPath = path.join(this.legacyDir, `${locale}-componentTranslations.json`);
      
      try {
        const modularStats = await fs.stat(modularPath);
        const legacyStats = await fs.stat(legacyPath);
        
        const modularContent = JSON.parse(await fs.readFile(modularPath, 'utf-8'));
        const keyCount = this.countKeys(modularContent.translations);
        
        manifest.files[locale] = {
          modular: {
            path: `dist/${locale}.json`,
            size: modularStats.size,
            keys: keyCount
          },
          legacy: {
            path: `legacy/${locale}-componentTranslations.json`,
            size: legacyStats.size,
            keys: keyCount
          }
        };
        
        manifest.statistics.totalFiles += modularContent.$metadata.files;
        manifest.statistics.totalKeys += keyCount;
        
      } catch (error) {
        console.warn(`⚠️ Could not generate stats for ${locale}: ${error.message}`);
      }
    }

    const manifestPath = path.join(this.outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`   ✅ Manifest generated: ${manifestPath}`);
    console.log(`   📊 Total locales: ${manifest.statistics.totalLocales}`);
    console.log(`   📊 Total files: ${manifest.statistics.totalFiles}`);
    console.log(`   📊 Total keys: ${manifest.statistics.totalKeys}`);
  }

  countKeys(translations) {
    let count = 0;
    for (const component of Object.values(translations)) {
      count += this.countObjectKeys(component);
    }
    return count;
  }

  countObjectKeys(obj) {
    let count = 0;
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('$')) continue; // Skip metadata
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.value !== undefined) {
          count++; // New format object
        } else {
          count += this.countObjectKeys(value); // Nested object
        }
      } else {
        count++; // Primitive value
      }
    }
    return count;
  }

  async getVersion() {
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'build';
  const options = {
    locale: args.find(arg => arg.startsWith('--locale='))?.split('=')[1],
    format: args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'all',
    verbose: args.includes('--verbose')
  };

  const builder = new TranslationBuilder();

  switch (command) {
    case 'build':
      if (options.locale) {
        await builder.buildLocale(options.locale);
        await builder.generateExports();
      } else {
        await builder.buildAll();
      }
      break;
      
    case 'clean':
      console.log('🧹 Cleaning build output...');
      await fs.rm(builder.outputDir, { recursive: true, force: true });
      await fs.rm(builder.legacyDir, { recursive: true, force: true });
      console.log('✅ Build output cleaned');
      break;
      
    default:
      console.log(`
Translation Build Tool

Usage: node build-translations.js [command] [options]

Commands:
  build               - Build all translations (default)
  clean               - Clean build output

Options:
  --locale=<code>     - Build specific locale only
  --format=<type>     - Output format: modular, legacy, or all (default: all)
  --verbose           - Verbose output

Examples:
  node build-translations.js                    # Build all
  node build-translations.js --locale=es        # Build Spanish only
  node build-translations.js clean              # Clean build files
      `);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TranslationBuilder };