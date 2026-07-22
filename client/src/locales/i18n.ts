import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import your JSON translations
import translationEn from './en/translation.json';
import translationAr from './ar/translation.json';
import translationCa from './ca/translation.json';
import translationCs from './cs/translation.json';
import translationDa from './da/translation.json';
import translationDe from './de/translation.json';
import translationEs from './es/translation.json';
import translationEt from './et/translation.json';
import translationFa from './fa/translation.json';
import translationFr from './fr/translation.json';
import translationIt from './it/translation.json';
import translationPl from './pl/translation.json';
import translationPt_BR from './pt-BR/translation.json';
import translationPt_PT from './pt-PT/translation.json';
import translationRu from './ru/translation.json';
import translationJa from './ja/translation.json';
import translationKa from './ka/translation.json';
import translationSv from './sv/translation.json';
import translationKo from './ko/translation.json';
import translationLt from './lt/translation.json';
import translationLv from './lv/translation.json';
import translationTh from './th/translation.json';
import translationTr from './tr/translation.json';
import translationUg from './ug/translation.json';
import translationVi from './vi/translation.json';
import translationNl from './nl/translation.json';
import translationNn from './nn/translation.json';
import translationId from './id/translation.json';
import translationIs from './is/translation.json';
import translationHe from './he/translation.json';
import translationHu from './hu/translation.json';
import translationHy from './hy/translation.json';
import translationFi from './fi/translation.json';
import translationZh_Hans from './zh-Hans/translation.json';
import translationZh_Hant from './zh-Hant/translation.json';
import translationSk from './sk/translation.json';
import translationBo from './bo/translation.json';
import translationUk from './uk/translation.json';
import translationBs from './bs/translation.json';
import translationNb from './nb/translation.json';
import translationSl from './sl/translation.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: translationEn },
  ar: { translation: translationAr },
  bs: { translation: translationBs },
  ca: { translation: translationCa },
  cs: { translation: translationCs },
  'zh-Hans': { translation: translationZh_Hans },
  'zh-Hant': { translation: translationZh_Hant },
  da: { translation: translationDa },
  de: { translation: translationDe },
  es: { translation: translationEs },
  et: { translation: translationEt },
  fa: { translation: translationFa },
  fr: { translation: translationFr },
  it: { translation: translationIt },
  nb: { translation: translationNb },
  pl: { translation: translationPl },
  'pt-BR': { translation: translationPt_BR },
  'pt-PT': { translation: translationPt_PT },
  ru: { translation: translationRu },
  ja: { translation: translationJa },
  ka: { translation: translationKa },
  sv: { translation: translationSv },
  ko: { translation: translationKo },
  lt: { translation: translationLt },
  lv: { translation: translationLv },
  th: { translation: translationTh },
  tr: { translation: translationTr },
  ug: { translation: translationUg },
  vi: { translation: translationVi },
  nl: { translation: translationNl },
  nn: { translation: translationNn },
  id: { translation: translationId },
  is: { translation: translationIs },
  he: { translation: translationHe },
  hu: { translation: translationHu },
  hy: { translation: translationHy },
  fi: { translation: translationFi },
  sk: { translation: translationSk },
  bo: { translation: translationBo },
  sl: { translation: translationSl },
  uk: { translation: translationUk },
} as const;

/** Base language codes that render right-to-left. */
const rtlLanguages = new Set(['ar', 'fa', 'he', 'ug', 'ur', 'yi', 'ckb', 'ps', 'sd']);

/** True when a (possibly region-suffixed) language code is right-to-left, e.g. `he-IL`. */
export const isRTLLang = (lng?: string) =>
  rtlLanguages.has((lng ?? '').toLowerCase().split('-')[0] ?? '');

/**
 * Sync `<html dir>` and `<html lang>` to the active language, so the whole UI flips
 * for RTL locales and assistive tech announces the right language.
 *
 * `lang` matters as much as `dir`: index.html hardcodes `lang="en-US"` and upstream
 * only refreshes it from the Settings tab and the share view — neither of which runs
 * on the auth screens. Left alone, a screen reader reads Hebrew with an English voice.
 * This runs on every `languageChanged`, so it is the one place that covers all paths.
 */
const applyDocumentLanguage = (lng?: string) => {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dir = isRTLLang(lng) ? 'rtl' : 'ltr';
  if (lng != null && lng !== '') {
    document.documentElement.lang = lng;
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Open Brain: Hebrew-first. The detector's implicit sources (navigator,
    // htmlTag, path, subdomain) are dropped so a first-time visitor resolves to
    // nothing and lands on the `default` fallback below — Hebrew — instead of
    // inheriting the browser's locale. The explicit sources are kept and cached,
    // so a language picked in Settings persists and still wins on the next boot.
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'sessionStorage'],
      caches: ['localStorage'],
    },
    fallbackLng: {
      'zh-TW': ['zh-Hant', 'en'],
      'zh-HK': ['zh-Hant', 'en'],
      zh: ['zh-Hans', 'en'],
      // he first, en behind it: Hebrew is ~70% complete upstream, so an
      // untranslated key still renders English rather than its raw key name.
      default: ['he', 'en'],
    },
    fallbackNS: 'translation',
    ns: ['translation'],
    debug: false,
    defaultNS,
    resources,
    interpolation: { escapeValue: false },
  });

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
