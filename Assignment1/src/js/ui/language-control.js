import { getLocale, t } from '../core/i18n.js';
export function renderLanguageToggle() {
  const english = getLocale() === 'en';
  return `<button id="language-toggle" class="icon-button language-toggle" data-action="language" aria-label="${t(english ? '切换到中文' : '切换到英文')}" title="${t(english ? '切换到中文' : '切换到英文')}"><span lang="${english ? 'zh-CN' : 'en'}">${english ? '中文' : 'EN'}</span></button>`;
}
