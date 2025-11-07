# Translation Safety Guide

This document explains the translation safety mechanisms implemented to prevent data loss during Crowdin sync operations.

## Problem: Lost Translations During Crowdin Sync

### What Happened
During a Crowdin translation update, Spanish translations for `matrixReasoningDescription` and `matrixReasoningName` were accidentally lost. The issue occurred in this sequence:

1. **Crowdin Download**: Downloaded files to `main/dashboard/` (correct translations)
2. **Sync Process**: `syncCsvsToConsolidated()` copied files from `main/dashboard/` to `consolidated/`
3. **Data Loss**: Spanish translations were lost during the sync process
4. **No Detection**: The loss wasn't caught until manual review

### Root Cause
- Simple file copy operation without validation
- No safety checks for critical translations
- No backup/restore mechanism
- Validation only ran after sync, not during

## Solution: Comprehensive Safety System

### 1. Translation Safety Check (`translation-safety-check.js`)

**Purpose**: Validates that critical translations are preserved during sync operations.

**Features**:
- **Critical Translation Monitoring**: Tracks specific translations that should never be empty
- **Coverage Analysis**: Detects significant drops in translation coverage
- **Empty Locale Detection**: Identifies completely empty locale columns
- **Detailed Reporting**: Provides clear error messages and coverage statistics

**Usage**:
```bash
npm run i18n:safety-check
```

**Critical Translations Monitored**:
- `components/game-tabs.matrixReasoningDescription` (es-CO, es-AR)
- `components/game-tabs.matrixReasoningName` (es-CO, es-AR)

### 2. Enhanced Sync Process (`pull-json.js`)

**Improvements**:
- **Automatic Backup**: Creates timestamped backups before sync
- **Safety Check Integration**: Runs validation after sync, before JSON generation
- **Fail-Fast**: Aborts sync if critical translations are lost
- **Better Error Messages**: Clear indication of what went wrong

**New Workflow**:
1. Download from Crowdin
2. Create backup of existing translations
3. Sync files to consolidated directory
4. Run safety check
5. If safe: Generate JSON files
6. If unsafe: Abort and report issues

### 3. Backup System

**Location**: `src/translations/consolidated/.backup/`

**Structure**:
```
.backup/
├── pre-sync-2025-10-30T10-30-00-000Z/
│   ├── dashboard-translations.csv
│   └── components/
│       ├── game-tabs-translations.csv
│       ├── navbar-translations.csv
│       └── ...
```

**Benefits**:
- Automatic timestamped backups
- Easy restoration if issues are detected
- Historical record of changes

## Usage Guide

### Running Translation Updates Safely

**Recommended Workflow**:
```bash
# 1. Run the full sync process (includes safety checks)
npm run i18n:pull-json

# 2. If issues are detected, review and fix
npm run i18n:safety-check

# 3. Validate all translations
npm run i18n:validate
```

### Manual Safety Check

**Before making changes**:
```bash
npm run i18n:safety-check
```

**After Crowdin updates**:
```bash
npm run i18n:safety-check
```

### Adding New Critical Translations

To monitor additional translations, edit `src/translations/tools/translation-safety-check.js`:

```javascript
const CRITICAL_TRANSLATIONS = {
  'components/game-tabs.matrixReasoningDescription': {
    'es-CO': 'Encuentra la pieza que falta para completar el rrompecabezas.',
    'es-AR': 'Encuentra la pieza que falta para completar el rrompecabezas.'
  },
  'components/game-tabs.matrixReasoningName': {
    'es-CO': 'Razonamiento Matricial',
    'es-AR': 'Razonamiento Matricial'
  },
  // Add new critical translations here
  'components/your-component.yourKey': {
    'es-CO': 'Expected Spanish translation',
    'es-AR': 'Expected Spanish translation'
  }
};
```

## Error Handling

### Safety Check Failures

**ERROR Level** (Process exits with code 1):
- Critical translations are missing or incorrect
- Must be fixed before proceeding

**WARNING Level** (Process continues):
- Empty locale columns (expected for untranslated languages)
- Low coverage (may be expected for new locales)

### Recovery Process

**If translations are lost**:

1. **Check the backup**:
   ```bash
   ls src/translations/consolidated/.backup/
   ```

2. **Restore from backup**:
   ```bash
   cp src/translations/consolidated/.backup/pre-sync-TIMESTAMP/components/game-tabs-translations.csv src/translations/consolidated/components/
   ```

3. **Re-run safety check**:
   ```bash
   npm run i18n:safety-check
   ```

4. **Regenerate JSON**:
   ```bash
   npm run i18n:csv-to-json
   ```

## Prevention Best Practices

### 1. Always Use the Safe Workflow
- Use `npm run i18n:pull-json` instead of manual file operations
- Never skip the safety check
- Review warnings before proceeding

### 2. Monitor Critical Translations
- Add new critical translations to the safety check
- Review coverage reports regularly
- Test with different locales

### 3. Regular Validation
- Run safety checks before commits
- Include in CI/CD pipeline
- Monitor translation coverage trends

### 4. Backup Management
- Keep recent backups
- Clean up old backups periodically
- Document any manual fixes

## Integration with CI/CD

The safety check can be integrated into CI/CD pipelines:

```yaml
- name: Translation Safety Check
  run: npm run i18n:safety-check
  env:
    I18N_FAIL_ON_LOW_COVERAGE: 'TRUE'
    I18N_COVERAGE_THRESHOLD: '80'
```

## Troubleshooting

### Common Issues

**"Translation safety check failed"**:
- Check which translations are missing
- Restore from backup if needed
- Fix the translations manually

**"Low coverage warnings"**:
- Expected for new or untranslated locales
- Can be ignored if intentional
- Adjust thresholds if needed

**"Empty locale column"**:
- Expected for untranslated languages
- Can be ignored if intentional
- Add translations if needed

### Getting Help

1. Check the safety check output for specific errors
2. Review the backup directory for previous versions
3. Compare with the main branch to see what changed
4. Run individual validation steps to isolate issues

## Future Improvements

### Planned Enhancements
- **Automatic Recovery**: Auto-restore from backup when issues detected
- **Translation Diff**: Show exactly what changed during sync
- **Coverage Trends**: Track translation coverage over time
- **Smart Validation**: Learn from patterns to reduce false positives

### Contributing
To improve the safety system:
1. Add new critical translations to monitor
2. Enhance validation rules
3. Improve error messages
4. Add new safety checks

---

**Remember**: The safety system is designed to prevent data loss, but it's not a substitute for careful review of translation changes. Always review the safety check output and understand what changes are being made.
