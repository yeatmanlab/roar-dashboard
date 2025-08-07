# LEVANTE Dashboard Translation Management System

A comprehensive, Crowdin-integrated translation management system for the LEVANTE research platform.

## 🌍 Overview

This system manages translations for the LEVANTE Dashboard, a research platform for studying how children learn and read. The platform serves researchers, educators, families, and children across multiple languages and regions.

### Current Language Support
- **English (en)** - Base language 
- **Spanish (es)** - General Spanish
- **Spanish Colombia (es-CO)** - Colombian variant
- **German (de)** - German
- **English US (en-US)** - US English variant

## 📁 Directory Structure

```
src/translations/
├── base/                           # Foundation files
│   ├── component-manifest.json    # Maps components to translation files
│   ├── metadata-schema.json       # JSON schema for translation files
│   └── translation-keys.json      # Master key registry
├── locales/                       # Modular translation files
│   ├── en/                        # English (source language)
│   │   ├── auth/                  # Authentication components
│   │   ├── components/            # Reusable UI components
│   │   ├── pages/                 # Page-specific content
│   │   └── surveys/               # Survey-related text
│   ├── es/                        # Spanish translations
│   ├── de/                        # German translations
│   ├── es-CO/                     # Colombian Spanish
│   └── en-US/                     # US English
├── tools/                         # Management scripts
│   ├── extract-keys.js           # Extract i18n keys from code
│   ├── validate-translations.js  # Quality assurance checks
│   ├── crowdin-sync.js           # Crowdin synchronization
│   ├── crowdin-seed-upload.js    # Initial seed data upload
│   ├── migrate-existing.js       # Convert legacy translations
│   └── build-translations.js     # Compile for production
├── crowdin/                       # Crowdin integration
│   ├── crowdin.yml               # Crowdin configuration
│   ├── glossary.csv              # Translation glossary
│   └── context/                  # Context docs for translators
├── reports/                       # Validation and status reports
├── legacy/                        # Original translation files
└── dist/                         # Compiled translations
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- Crowdin CLI installed (`@crowdin/cli`)
- `CROWDIN_API_TOKEN` environment variable set

### Initial Setup
```bash
# 1. Migrate existing translations to new structure
npm run i18n:migrate

# 2. Validate current translations
npm run i18n:validate

# 3. Upload seed data to Crowdin (one-time)
npm run i18n:crowdin:seed

# 4. Set up regular sync workflow
npm run i18n:crowdin:upload
```

## 📋 Available Scripts

### Translation Management
```bash
# Extract translation keys from code
npm run i18n:extract

# Validate translation completeness and quality  
npm run i18n:validate

# Build translations for production
npm run i18n:build

# Generate comprehensive report
npm run i18n:report
```

### Crowdin Integration
```bash
# Upload source files to Crowdin
npm run i18n:crowdin:upload

# Upload existing translations as seed data (one-time)
npm run i18n:crowdin:seed

# Download completed translations from Crowdin
npm run i18n:crowdin:download

# Check Crowdin project status
npm run i18n:crowdin:status

# Full sync workflow
npm run i18n:crowdin:sync

# Initialize Crowdin project
npm run i18n:crowdin:init
```

### Legacy Support
```bash
# Migrate from old translation format
npm run i18n:migrate
```

## 📊 Current Translation Status

**Last Validation**: Latest validation shows:
- **Total Files**: 48 translation files
- **Total Keys**: 1,408 translation keys
- **Completeness**: 78% overall
- **Missing Translations**: 305 keys need translation
- **Issues**: 35 items need attention

### Completeness by Language
- **English (en)**: 100% (source language)
- **Spanish (es)**: ~85% complete
- **German (de)**: ~70% complete  
- **Spanish Colombia (es-CO)**: ~60% complete
- **English US (en-US)**: ~90% complete

## 🔧 Translation File Format

### Enhanced JSON Structure
```json
{
  "$schema": "../../base/metadata-schema.json",
  "$metadata": {
    "component": "authSignIn",
    "lastUpdated": "2025-01-15T10:30:00Z",
    "completeness": 100,
    "context": "User authentication and sign-in forms"
  },
  "translations": {
    "buttonLabel": {
      "value": "Go!",
      "context": "Primary CTA button for sign-in",
      "maxLength": 20,
      "notes": "Should be energetic and inviting"
    },
    "emailPlaceholder": {
      "value": "Username or email",
      "context": "Input field placeholder"
    }
  }
}
```

### Simple String Format (also supported)
```json
{
  "$metadata": { /* ... */ },
  "translations": {
    "simpleKey": "Simple translated text",
    "anotherKey": "Another translation"
  }
}
```

## 🌐 Crowdin Integration

### Project Configuration
- **Project**: `levantetranslations`
- **Dashboard Folder**: All dashboard translations are organized under `/dashboard/` in Crowdin
- **File Structure**: Mirrors the local `locales/` directory structure

### Workflow
1. **Source Upload**: English files are uploaded as source content
2. **Translation**: Professional translators work in Crowdin interface
3. **Review**: Translations go through review process
4. **Download**: Completed translations are downloaded back to project

### Quality Assurance Features
- **Translation Memory**: Reuses previous translations
- **Glossary**: Consistent terminology across all content
- **Context**: Screenshots and descriptions for translators
- **Validation Rules**: Checks for placeholders, length limits, formatting

## 🎯 Content Types & Guidelines

### For Child-Facing Content
- **Tone**: Friendly, encouraging, motivational
- **Language**: Simple, clear, age-appropriate (5-12 years)
- **Length**: Concise but complete

### For Adult-Facing Content  
- **Tone**: Professional but accessible
- **Language**: Clear, precise, supportive
- **Technical Terms**: Explained when necessary

### Button & UI Text
- **Buttons**: Clear, actionable (< 20 characters)
- **Labels**: Brief but informative (< 30 characters)
- **Error Messages**: Helpful, not technical (< 100 characters)

## 🔍 Quality Assurance

### Automated Validation
- **Completeness Check**: Identifies missing translations
- **Variable Consistency**: Ensures placeholders match across languages
- **HTML Safety**: Validates HTML tags in translations
- **Length Limits**: Checks character limits for UI elements
- **Schema Validation**: Verifies JSON structure

### Manual Review Process
1. **Translator**: Initial translation in Crowdin
2. **Proofreader**: Language quality review
3. **Context Review**: Subject matter expert verification
4. **Final Approval**: Release approval

## 🚨 Troubleshooting

### Common Issues

**Validation Errors**
```bash
# Check validation report
npm run i18n:validate
# View detailed report
cat src/translations/reports/validation-report.md
```

**Crowdin Sync Problems**
```bash
# Check Crowdin status
npm run i18n:crowdin:status
# Re-upload sources
npm run i18n:crowdin:upload
```

**Missing Translations**
- Check validation report for specific missing keys
- Verify translations exist in Crowdin project
- Ensure proper file paths in Crowdin configuration

### Environment Variables
```bash
# Required for Crowdin integration
export CROWDIN_API_TOKEN="your-api-token"

# Optional: Override project ID
export CROWDIN_PROJECT_ID="levantetranslations"
```

## 📈 Development Workflow

### Adding New Translations
1. Add translation keys to appropriate English files
2. Run `npm run i18n:extract` to detect new keys
3. Run `npm run i18n:crowdin:upload` to send to Crowdin
4. Wait for translation completion
5. Run `npm run i18n:crowdin:download` to get translations

### Modifying Existing Translations
1. Update English source files
2. Upload changes to Crowdin
3. Translators will be notified of changes
4. Download updated translations when complete

### Quality Checks
```bash
# Before any release
npm run i18n:validate
npm run i18n:report

# Ensure all critical languages are complete
npm run i18n:crowdin:status
```

## 🤝 Contributing

### For Developers
1. Always run validation before committing changes
2. Use the extraction tool to detect new translation keys
3. Provide context and character limits for new translations
4. Follow the established file structure

### For Translators
1. Work in the Crowdin interface at: https://crowdin.com/project/levantetranslations
2. Refer to the glossary for consistent terminology
3. Use the context documentation for guidance
4. Ask questions using Crowdin's comment feature

## 📚 Resources

### Documentation
- [Crowdin API Documentation](https://developer.crowdin.com/)
- [Vue i18n Guide](https://vue-i18n.intlify.dev/)
- [Translation Best Practices](./context/dashboard-overview.md)

### Key Files
- **Validation Reports**: `src/translations/reports/`
- **Crowdin Config**: `src/translations/crowdin/crowdin.yml`
- **Component Mapping**: `src/translations/base/component-manifest.json`
- **Glossary**: `src/translations/crowdin/glossary.csv`

## 📞 Support

For technical issues with the translation system:
1. Check this README and troubleshooting section
2. Review validation reports for specific errors
3. Check Crowdin project status and comments
4. Contact the development team with specific error messages

---

**Last Updated**: January 2025  
**System Version**: 2.0.0  
**Crowdin Project**: [levantetranslations](https://crowdin.com/project/levantetranslations)