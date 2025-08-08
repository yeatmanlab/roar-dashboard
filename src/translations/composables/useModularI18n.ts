import { createI18n, type I18nOptions } from 'vue-i18n'

type FlatTranslations = Record<string, string>

const modules = import.meta.glob('../locales/**/*.json', { eager: true }) as Record<string, any>

function normalizeLocaleKey(p: string): string | null {
  const m = p.match(/locales\/(.+?)\//)
  return m ? m[1].toLowerCase() : null
}

function normalizeSectionAndName(p: string): { section: string; name: string } | null {
  const m = p.match(/locales\/.+?\/(.+?)\/(.+?)\.json$/)
  if (!m) return null
  return { section: m[1], name: m[2] }
}

async function loadAllMessages(): Promise<Record<string, FlatTranslations>> {
  const messages: Record<string, FlatTranslations> = {}
  Object.entries(modules).forEach(([path, mod]) => {
    const locale = normalizeLocaleKey(path)
    const sectionAndName = normalizeSectionAndName(path)
    if (!locale || !sectionAndName) return
    const keyPrefix = `${sectionAndName.section}.${sectionAndName.name}`
    const json = (mod?.default ?? mod) as Record<string, string>
    const flat: FlatTranslations = messages[locale] ?? {}
    Object.entries(json).forEach(([k, v]) => {
      flat[`${keyPrefix}.${k}`] = v as string
    })
    messages[locale] = flat
  })
  return messages
}

export async function createModularI18n() {
  const msgs = await loadAllMessages()
  const browserLocale = (navigator.language || 'en').toLowerCase()
  const available = Object.keys(msgs)
  let locale = 'en'
  if (available.includes(browserLocale)) locale = browserLocale
  else {
    const lang = browserLocale.split('-')[0]
    const match = available.find((l) => l.startsWith(lang))
    if (match) locale = match
  }
  const options: I18nOptions = {
    legacy: false,
    globalInjection: true,
    locale,
    fallbackLocale: 'en',
    messages: msgs,
  }
  return createI18n(options)
}


