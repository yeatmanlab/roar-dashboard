#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../..');
const translationsRoot = path.resolve(projectRoot, 'src/translations');
const consolidatedRoot = path.resolve(translationsRoot, 'consolidated');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function flatten(obj, prefix = '') {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  });
  return out;
}

// Map top-level legacy namespaces to modular paths (section/component)
const namespaceMap = {
  navBar: 'components/navbar',
  gameTabs: 'components/game-tabs',
  participantSidebar: 'components/participant-sidebar',
  sentryForm: 'components/sentry-form',
  tasks: 'components/tasks',
  notFound: 'pages/not-found',
  pageSignIn: 'pages/signin',
  homeParticipant: 'pages/home-participant',
  homeSelector: 'pages/home-selector',
  consentModal: 'auth/consent',
  authSignIn: 'auth/signin',
  userSurvey: 'surveys/user-survey',
};

function detectLanguageFiles() {
  // Collect component translation files by language
  const candidates = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('componentTranslations.json')) candidates.push(full);
    }
  };
  walk(path.join(translationsRoot));
  return candidates;
}

function languageCodeFromPath(p) {
  // src/translations/es/co/es-co-componentTranslations.json -> es-co
  const base = path.basename(p).replace('-componentTranslations.json', '');
  if (base.includes('-')) return base;
  // src/translations/en/en-componentTranslations.json -> en
  return base;
}

function loadAllLanguages() {
  const files = detectLanguageFiles();
  const langs = new Map(); // lang -> json
  for (const f of files) {
    const json = readJsonSafe(f);
    if (!json) continue;
    const code = languageCodeFromPath(f);
    langs.set(code, json);
  }
  return langs;
}

function buildRows(langs) {
  // keys: identifier, label, ...langs
  const allIdentifiers = new Set();
  const perLangFlat = {};
  for (const [lang, json] of langs.entries()) {
    perLangFlat[lang] = {};
    for (const [ns, value] of Object.entries(json || {})) {
      const mapped = namespaceMap[ns];
      if (!mapped) continue;
      const flat = flatten(value);
      for (const [k, v] of Object.entries(flat)) {
        const identifier = `${mapped}.${k}`;
        allIdentifiers.add(identifier);
        perLangFlat[lang][identifier] = typeof v === 'string' ? v : '';
      }
    }
  }
  return { allIdentifiers: Array.from(allIdentifiers).sort(), perLangFlat };
}

function groupBySection(identifiers) {
  const groups = new Map(); // section -> identifiers[]
  identifiers.forEach((id) => {
    // identifier looks like: "components/navbar.something" or "auth/consent.something"
    const firstToken = id.split('.')[0]; // e.g., "components/navbar" or "auth/consent"
    const section = firstToken.split('/')[0]; // e.g., "components" or "auth"
    const list = groups.get(section) ?? [];
    list.push(id);
    groups.set(section, list);
  });
  return groups;
}

function toCsvLine(values) {
  return values
    .map((v) => {
      const s = v == null ? '' : String(v);
      // Escape newlines, carriage returns, and quotes for CSV
      const escaped = s.replace(/\r?\n/g, '\\n').replace(/\r/g, '\\r');
      return escaped.includes(',') || escaped.includes('"') || s.includes('\n') || s.includes('\r')
        ? '"' + escaped.replace(/"/g, '""') + '"'
        : escaped;
    })
    .join(',');
}

function writeConsolidatedCSVs({ allIdentifiers, perLangFlat }, langs) {
  ensureDir(consolidatedRoot);
  const detectedLangs = Array.from(langs.keys());

  // Desired CSV column order (after identifier,label)
  // Include requested regional variants; seed en-GH from en, de-CH from de, es-AR from es-CO
  const OUTPUT_LANGS = ['en', 'es-CO', 'de', 'fr-CA', 'nl', 'en-GH', 'de-CH', 'es-AR'];

  // Helper to fetch value for a given identifier and output language with fallbacks
  const getValue = (identifier, outLang) => {
    const key = identifier;
    const pick = (code) => perLangFlat[code]?.[key];
    switch (outLang) {
      case 'en':
        return pick('en') ?? pick('en-us') ?? '';
      case 'es-CO':
        return pick('es-co') ?? pick('es') ?? '';
      case 'de':
        return pick('de') ?? '';
      case 'fr-CA':
        return pick('fr-ca') ?? '';
      case 'nl':
        return pick('nl') ?? '';
      case 'en-GH':
        // Seed from existing English content
        return pick('en-gh') ?? pick('en') ?? pick('en-us') ?? '';
      case 'de-CH':
        // Seed from existing German content
        return pick('de-ch') ?? pick('de') ?? '';
      case 'es-AR':
        // Seed from existing Spanish Colombian content
        return pick('es-ar') ?? pick('es-co') ?? pick('es') ?? '';
      default:
        return '';
    }
  };

  // Split identifiers: components vs. main (auth/pages/surveys/etc.)
  const mainIds = [];
  const componentMap = new Map(); // componentName -> ids[]

  allIdentifiers.forEach((id) => {
    const firstToken = id.split('.')[0]; // e.g., 'components/navbar'
    const [section, maybeComponent] = firstToken.split('/');
    if (section === 'components') {
      const componentName = maybeComponent || 'unnamed';
      const list = componentMap.get(componentName) ?? [];
      list.push(id);
      componentMap.set(componentName, list);
    } else {
      mainIds.push(id);
    }
  });

  // Write main dashboard file: dashboard-translations.csv
  if (mainIds.length) {
    const out = [];
    const header = ['identifier', 'label', ...OUTPUT_LANGS];
    out.push(toCsvLine(header));
    mainIds.sort().forEach((id) => {
      const label = id.split('.').slice(-1)[0];
      const row = [id, label];
      OUTPUT_LANGS.forEach((lang) => row.push(getValue(id, lang)));
      out.push(toCsvLine(row));
    });
    const file = path.join(consolidatedRoot, `dashboard-translations.csv`);
    fs.writeFileSync(file, out.join('\n'));
  }

  // Write component files under consolidated/components/<component>-translations.csv
  const componentsDir = path.join(consolidatedRoot, 'components');
  ensureDir(componentsDir);
  for (const [componentName, ids] of componentMap.entries()) {
    const out = [];
    const header = ['identifier', 'label', ...OUTPUT_LANGS];
    out.push(toCsvLine(header));
    ids.sort().forEach((id) => {
      const label = id.split('.').slice(-1)[0];
      const row = [id, label];
      OUTPUT_LANGS.forEach((lang) => row.push(getValue(id, lang)));
      out.push(toCsvLine(row));
    });
    const safeName = componentName.replace(/[\\/]/g, '-');
    const file = path.join(componentsDir, `${safeName}-translations.csv`);
    fs.writeFileSync(file, out.join('\n'));
  }

  return detectedLangs;
}

function main() {
  console.log('🧩 Consolidating translations from legacy component files...');
  const langs = loadAllLanguages();
  if (!langs.size) {
    console.log('No componentTranslations.json files found. Nothing to consolidate.');
    return;
  }
  const merged = buildRows(langs);
  const detected = writeConsolidatedCSVs(merged, langs);
  console.log(`✅ Wrote consolidated CSVs for languages: ${detected.join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
