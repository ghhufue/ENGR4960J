import { icon } from './icons.js';
export function renderThemeToggle(theme) {
  const dark = theme === 'dark';
  return `<button id="theme-toggle" class="icon-button theme-toggle" data-action="theme" aria-label="深色模式" aria-pressed="${dark}" title="${dark ? '切换到亮色模式' : '切换到深色模式'}">${icon(dark ? 'sun' : 'moon')}</button>`;
}
