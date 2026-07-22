import Cookies from 'js-cookie';
import { atomWithLocalStorage } from './utils';

// Open Brain: Hebrew-first. This atom is the real language source of truth —
// useLocalize pushes it into i18next via changeLanguage on mount, so it wins over
// anything the i18next LanguageDetector resolves. An explicit choice (the Settings
// dropdown, persisted to cookie/localStorage) still takes priority; only the
// implicit `navigator.language` fallback is replaced, so a studio machine running
// an English OS still opens the app in Hebrew.
const defaultLang = () => Cookies.get('lang') || localStorage.getItem('lang') || 'he';

const lang = atomWithLocalStorage('lang', defaultLang());

export default { lang };
