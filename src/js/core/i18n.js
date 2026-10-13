import { EN } from '../i18n/en.js';
import { PATTERNS } from '../i18n/patterns.js';
export const LANGUAGE_KEY = 'engr4960j.ethics-workbench.language';
let locale = 'zh-CN';
export function getLocale() { return locale; }
export function readLanguage(storage) { try { return storage?.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'zh-CN'; } catch { return 'zh-CN'; } }
export function setLanguage(value, root = null) { locale = value === 'en' ? 'en' : 'zh-CN'; root?.setAttribute('lang', locale); return locale; }
export function saveLanguage(storage) { try { if (!storage) return false; storage.setItem(LANGUAGE_KEY, locale); return true; } catch { return false; } }
export function t(source, parameters = {}) {
  let message = String(source ?? '');
  if (locale === 'en') {
    if (Object.hasOwn(EN, message)) message = EN[message];
    else for (const [pattern, render] of PATTERNS) { const match = message.match(pattern); if (match) { message = render(match, t); break; } }
  }
  return message.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(parameters, key) ? String(parameters[key]) : match);
}
