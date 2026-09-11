const isEnglish = (langCode?: string) => {
  if (!langCode) return false;
  const normalized = langCode.toLowerCase();
  return normalized === 'en' || normalized.startsWith('en-');
};

const isSpanishAR = (langCode?: string) => {
  return langCode === 'es-AR';
};

export const isLanguageAllowedDownex = (langCode?: string) => {
  return isSpanishAR(langCode) || isEnglish(langCode);
};
