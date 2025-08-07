#!/usr/bin/env node

/**
 * Translation Validation Tool
 * Checks translation completeness, consistency, and formatting
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

const SUPPORTED_LOCALES = ['en', 'es', 'de', 'es-CO', 'en-US'];
const VARIABLE_PATTERN = /\{([^}]+)\}/g;
const HTML_PATTERN = /<[^>]+>/g;

class TranslationValidator {
  constructor() {
    this.issues = [];
    this.stats = {
      totalFiles: 0,
      totalKeys: 0,
      missingTranslations: 0,
      inconsistentVariables: 0,
      lengthViolations: 0,
      htmlMismatches: 0
    };
  }

  async validateAllLocales() {
    console.log('🔍 Validating translations across all locales...');
    
    const baseTranslations = await this.loadLocaleTranslations('en');
    
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en') continue; // Skip source locale
      
      console.log(`📋 Validating ${locale}...`);
      const localeTranslations = await this.loadLocaleTranslations(locale);
      await this.validateLocale(locale, baseTranslations, localeTranslations);
    }

    await this.generateReport();
  }

  async loadLocaleTranslations(locale) {
    const translations = {};
    const localeDir = path.join(__dirname, '../locales', locale);
    
    try {
      await fs.access(localeDir);
    } catch {
      this.addIssue('missing_locale', `Locale directory missing: ${locale}`, null, locale);
      return translations;
    }

    const translationFiles = await glob('**/*.json', { cwd: localeDir });
    
    for (const file of translationFiles) {
      const filePath = path.join(localeDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        if (data.translations) {
          // New format with metadata
          const component = data.$metadata?.component || this.getComponentFromPath(file);
          translations[component] = data.translations;
        } else {
          // Legacy format - assume entire file is translations
          const component = this.getComponentFromPath(file);
          translations[component] = data;
        }
        
        this.stats.totalFiles++;
      } catch (error) {
        this.addIssue('invalid_json', `Invalid JSON in ${file}: ${error.message}`, file, locale);
      }
    }

    return translations;
  }

  getComponentFromPath(filePath) {
    const name = path.basename(filePath, '.json');
    return name.replace(/^(en|es|de)-/, '').replace(/-/g, '_');
  }

  async validateLocale(locale, baseTranslations, localeTranslations) {
    for (const [component, baseKeys] of Object.entries(baseTranslations)) {
      const localeKeys = localeTranslations[component] || {};
      
      await this.validateComponent(locale, component, baseKeys, localeKeys);
    }
  }

  async validateComponent(locale, component, baseKeys, localeKeys) {
    this.validateCompleteness(locale, component, baseKeys, localeKeys);
    this.validateConsistency(locale, component, baseKeys, localeKeys);
  }

  validateCompleteness(locale, component, baseKeys, localeKeys) {
    const missingKeys = [];
    
    this.traverseKeys(baseKeys, localeKeys, '', (keyPath, baseValue, localeValue) => {
      if (localeValue === undefined || localeValue === null || localeValue === '') {
        missingKeys.push(keyPath);
        this.stats.missingTranslations++;
      }
    });

    if (missingKeys.length > 0) {
      this.addIssue(
        'missing_translations',
        `Missing ${missingKeys.length} translations in ${component}`,
        component,
        locale,
        { missingKeys }
      );
    }
  }

  validateConsistency(locale, component, baseKeys, localeKeys) {
    this.traverseKeys(baseKeys, localeKeys, '', (keyPath, baseValue, localeValue) => {
      if (!baseValue || !localeValue) return;

      const baseStr = this.extractStringValue(baseValue);
      const localeStr = this.extractStringValue(localeValue);

      if (!baseStr || !localeStr) return;

      // Check variable consistency
      const baseVars = this.extractVariables(baseStr);
      const localeVars = this.extractVariables(localeStr);
      
      if (!this.arraysEqual(baseVars, localeVars)) {
        this.stats.inconsistentVariables++;
        this.addIssue(
          'variable_mismatch',
          `Variable mismatch in ${component}.${keyPath}`,
          component,
          locale,
          { baseVars, localeVars, baseStr, localeStr }
        );
      }

      // Check HTML tag consistency
      const baseHtml = this.extractHtmlTags(baseStr);
      const localeHtml = this.extractHtmlTags(localeStr);
      
      if (!this.arraysEqual(baseHtml, localeHtml)) {
        this.stats.htmlMismatches++;
        this.addIssue(
          'html_mismatch',
          `HTML tag mismatch in ${component}.${keyPath}`,
          component,
          locale,
          { baseHtml, localeHtml, baseStr, localeStr }
        );
      }

      // Check length constraints
      const maxLength = this.extractMaxLength(baseValue);
      if (maxLength && localeStr.length > maxLength) {
        this.stats.lengthViolations++;
        this.addIssue(
          'length_violation',
          `Translation too long in ${component}.${keyPath} (${localeStr.length}>${maxLength})`,
          component,
          locale,
          { maxLength, actualLength: localeStr.length, text: localeStr }
        );
      }
    });
  }

  traverseKeys(baseObj, localeObj, prefix, callback) {
    if (!baseObj || typeof baseObj !== 'object') return;

    for (const [key, baseValue] of Object.entries(baseObj)) {
      const keyPath = prefix ? `${prefix}.${key}` : key;
      const localeValue = localeObj?.[key];

      if (typeof baseValue === 'object' && !Array.isArray(baseValue) && baseValue.value === undefined) {
        // Nested object
        this.traverseKeys(baseValue, localeValue || {}, keyPath, callback);
      } else {
        // Leaf value
        callback(keyPath, baseValue, localeValue);
        this.stats.totalKeys++;
      }
    }
  }

  extractStringValue(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.value) return value.value;
    return null;
  }

  extractMaxLength(value) {
    if (typeof value === 'object' && value.maxLength) return value.maxLength;
    return null;
  }

  extractVariables(str) {
    const matches = str.match(VARIABLE_PATTERN) || [];
    return matches.sort();
  }

  extractHtmlTags(str) {
    const matches = str.match(HTML_PATTERN) || [];
    return matches.sort();
  }

  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  addIssue(type, message, component, locale, details = {}) {
    this.issues.push({
      type,
      message,
      component,
      locale,
      details,
      timestamp: new Date().toISOString()
    });
  }

  async generateReport() {
    const reportDir = path.join(__dirname, '../reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        ...this.stats,
        issueCount: this.issues.length,
        localesChecked: SUPPORTED_LOCALES.length - 1, // Exclude source locale
        completeness: Math.round((1 - this.stats.missingTranslations / this.stats.totalKeys) * 100)
      },
      issues: this.issues.map(issue => ({
        ...issue,
        severity: this.getIssueSeverity(issue.type)
      })),
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(reportDir, 'validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate human-readable report
    const humanReportPath = path.join(reportDir, 'validation-report.md');
    await fs.writeFile(humanReportPath, this.generateMarkdownReport(report));

    console.log(`\n📊 Validation Report Summary:`);
    console.log(`   Total files checked: ${this.stats.totalFiles}`);
    console.log(`   Total translation keys: ${this.stats.totalKeys}`);
    console.log(`   Missing translations: ${this.stats.missingTranslations}`);
    console.log(`   Variable mismatches: ${this.stats.inconsistentVariables}`);
    console.log(`   HTML mismatches: ${this.stats.htmlMismatches}`);
    console.log(`   Length violations: ${this.stats.lengthViolations}`);
    console.log(`   Overall completeness: ${report.summary.completeness}%`);
    console.log(`\n📋 Reports generated:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   Markdown: ${humanReportPath}`);

    if (this.issues.length > 0) {
      console.log(`\n❌ Found ${this.issues.length} issues that need attention`);
      process.exit(1);
    } else {
      console.log(`\n✅ All translations are valid!`);
    }
  }

  getIssueSeverity(type) {
    const severityMap = {
      'missing_locale': 'high',
      'invalid_json': 'high',
      'missing_translations': 'medium',
      'variable_mismatch': 'high',
      'html_mismatch': 'high',
      'length_violation': 'low'
    };
    return severityMap[type] || 'medium';
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.stats.missingTranslations > 0) {
      recommendations.push("Upload missing translations to Crowdin for completion");
    }
    
    if (this.stats.inconsistentVariables > 0) {
      recommendations.push("Review variable usage in translations - ensure all placeholders are preserved");
    }
    
    if (this.stats.htmlMismatches > 0) {
      recommendations.push("Check HTML formatting in translations - tags should match source");
    }
    
    if (this.stats.lengthViolations > 0) {
      recommendations.push("Review overly long translations - consider more concise alternatives");
    }

    return recommendations;
  }

  generateMarkdownReport(report) {
    return `# Translation Validation Report

Generated: ${report.generatedAt}

## Summary

- **Total Files**: ${report.summary.totalFiles}
- **Total Keys**: ${report.summary.totalKeys}
- **Missing Translations**: ${report.summary.missingTranslations}
- **Variable Mismatches**: ${report.summary.inconsistentVariables}
- **HTML Mismatches**: ${report.summary.htmlMismatches}
- **Length Violations**: ${report.summary.lengthViolations}
- **Overall Completeness**: ${report.summary.completeness}%

## Issues Found

${report.issues.map(issue => `
### ${issue.type} (${issue.severity} severity)
**Component**: ${issue.component}  
**Locale**: ${issue.locale}  
**Message**: ${issue.message}

${issue.details ? Object.entries(issue.details).map(([key, value]) => `**${key}**: \`${JSON.stringify(value)}\``).join('\n') : ''}
`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}
`;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    locale: args.find(arg => arg.startsWith('--locale='))?.split('=')[1],
    component: args.find(arg => arg.startsWith('--component='))?.split('=')[1],
    verbose: args.includes('--verbose')
  };

  const validator = new TranslationValidator();

  if (options.locale) {
    console.log(`🔍 Validating specific locale: ${options.locale}`);
    // Implement single locale validation if needed
  } else {
    await validator.validateAllLocales();
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(console.error);
}

export { TranslationValidator };