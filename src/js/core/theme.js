// Theme is a browser preference, separate from project data and review state.
export const THEME_KEY = 'engr4960j.ethics-workbench.theme';
export function readTheme(storage) {
  try { return storage?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}
export function applyTheme(root, theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-theme', normalized);
  return normalized;
}
export function saveTheme(storage, theme) {
  try { if (!storage) return false; storage.setItem(THEME_KEY, theme === 'dark' ? 'dark' : 'light'); return true; } catch { return false; }
}
