import { t, getLocale } from './i18n.js';
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
export function textCount(value) {
  const text = String(value || '').trim();
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  return { chinese, words, label: chinese ? t('{chinese} 个汉字 · {words} 个英文词（估算）', { chinese, words }) : t('{words} words（估算）', { words }) };
}
export function safeFilename(title) {
  return String(title || '工程伦理分析').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 90) || '工程伦理分析';
}
export function safeUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function download(text, name, type = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toggleChoice(values, value, checked, exclusive = []) {
  if (!checked) return values.filter(item => item !== value);
  if (exclusive.includes(value)) return [value];
  return [...new Set([...values.filter(item => !exclusive.includes(item)), value])];
}
export function hasValue(value) { return Array.isArray(value) ? value.length > 0 : typeof value === 'boolean' ? value : String(value ?? '').trim().length > 0; }
export function fieldVisible(field, data) {
  if (!field.when) return true;
  const { key, values, absent } = field.when;
  return absent ? !hasValue(data[key]) : values.includes(data[key]);
}
export function timeLabel(value) { return value ? new Date(value).toLocaleString(getLocale(), { hour12: false }) : t('尚未保存'); }
