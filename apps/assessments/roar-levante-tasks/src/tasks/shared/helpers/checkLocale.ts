export const isEnglish = (langCode?: string) => {
  if (!langCode) return false;
  const normalized = langCode.toLowerCase();
  return normalized === 'en' || normalized.startsWith('en-');
};
