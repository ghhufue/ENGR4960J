import { Store, TYPE_STEPS, freshState, parseBackup } from './core/store.js';
import { escapeHtml, textCount, toggleChoice, safeUrl } from './core/utils.js';
import { markReviewed, reviewStatus } from './core/review.js';
import { validateStep } from './core/validation.js';
import { STEPS, getStep } from './features/analysis/index.js';
import { sourceSection } from './features/sources.js';
import { memberSection, iterationSection } from './features/reflection.js';
import { backup, exportNotes } from './features/backup.js';
import { renderFields, fieldId, TYPE_LABELS } from './ui/fields.js';
import { typeBadge } from './ui/records.js';
import { icon } from './ui/icons.js';
import { readTheme, applyTheme, saveTheme } from './core/theme.js';
import { renderThemeToggle } from './ui/theme-control.js';
import { renderOverview, renderStep, renderSources, renderReflection, renderChecks, renderTopbar, renderNav } from './ui/pages.js';
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const store = new Store(storage);
const validRoutes = new Set(['overview', 'sources', 'reflection', 'checks', ...STEPS.map(step => `step-${step.number}`)]);
const initialRoute = location.hash.slice(1) || store.state.lastRoute;
const ui = { route: validRoutes.has(initialRoute) ? initialRoute : 'overview', theme: readTheme(storage), presentation: false, editId: '', referenceId: '', showArchived: false, search: '', category: '', checks: {}, openImportance: false, returnContext: null };
applyTheme(document.documentElement, ui.theme);
const sections = [...STEPS.flatMap(step => step.sections), sourceSection, memberSection, iterationSection];
const sectionFor = type => sections.find(section => section.type === type);
const byId = id => document.getElementById(id);
let confirmCallback = null; let previousReferenceFocus = null;
function notice(message, persist = false) {
  const toast = byId('toast'); toast.textContent = message; toast.hidden = false;
  clearTimeout(notice.timer); if (!persist) notice.timer = setTimeout(() => { toast.hidden = true; }, 6500);
  byId('live-status').textContent = message;
}
function saveIndicator() {
  const element = byId('save-status'); if (!element) return;
  const labels = { idle: '本地保存', saving: '正在保存', saved: `已保存 ${store.savedAt ? new Date(store.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}`, failed: '保存失败 · 请导出备份' };
  element.textContent = labels[store.saveStatus]; element.classList.toggle('save-failed', store.saveStatus === 'failed'); element.title = store.error || '内容保存在当前浏览器，换设备前请导出项目备份。';
  if (store.error) { const banner = byId('storage-error') || document.createElement('div'); banner.id = 'storage-error'; banner.className = 'storage-error'; banner.setAttribute('role', 'alert'); banner.innerHTML = `<span>${escapeHtml(store.error)}</span><button class="button secondary" data-action="backup">导出备份</button>`; if (!banner.isConnected) byId('topbar').after(banner); } else byId('storage-error')?.remove();
}
function renderReference() {
  const aside = byId('reference'); const record = store.get(ui.referenceId);
  if (!record) { aside.hidden = true; document.body.classList.remove('has-reference'); return; }
  aside.hidden = false; document.body.classList.add('has-reference');
  const section = sectionFor(record.type); const url = safeUrl(record.data.url);
  aside.innerHTML = `<div class="reference-heading"><h2 tabindex="-1">关联材料</h2><button class="icon-button" data-action="close-reference" aria-label="关闭关联材料">${icon('close')}</button></div><div class="reference-content"><div class="record-meta">${typeBadge(record.type)}<span class="record-id">${record.id}</span>${record.archived ? '<span class="badge neutral">已归档</span>' : ''}</div><h3>${escapeHtml(record.data.title || '尚未命名')}</h3>${renderFields(store, section?.fields.filter(field => field.key !== 'title') || [], record.data, record.id, true)}${url ? `<a class="button secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">打开来源链接 ${icon('arrow')}</a>` : ''}<p class="subtle">版本 ${record.version} · ${escapeHtml(record.data.verification || '由组员自行核对')}</p></div><div class="reference-footer"><button class="button secondary" data-action="jump-record" data-id="${record.id}">到原位置${record.archived || ui.presentation ? '查看' : '修改'} ${icon('arrow')}</button></div>`;
}
function renderMain(preserve = false) {
  const active = document.activeElement; const activeId = preserve ? active?.id : ''; const cursor = preserve && active?.selectionStart; const scroll = window.scrollY;
  const openDetails = preserve ? [...byId('main').querySelectorAll('details[open][id]')].map(element => element.id) : [];
  let html;
  const step = ui.route.startsWith('step-') && getStep(ui.route.slice(5));
  if (step) html = renderStep(store, step, ui);
  else if (ui.route === 'sources') html = renderSources(store, ui);
  else if (ui.route === 'reflection') html = renderReflection(store, ui);
  else if (ui.route === 'checks') html = renderChecks(store, ui);
  else html = renderOverview(store, ui);
  if (ui.returnContext) html = `<button class="return-link text-button" data-action="return-context">${icon('back')} 返回关联记录</button>${html}`;
  byId('main').innerHTML = html;
  document.body.classList.toggle('presentation', ui.presentation);
  document.title = `${step ? `${step.number}. ${step.title}` : { overview: '案例概览', sources: '来源库', reflection: '过程与反思', checks: '完成检查' }[ui.route]} · 工程伦理工作台`;
  openDetails.forEach(id => { if (byId(id)) byId(id).open = true; });
  if (activeId && byId(activeId)) { byId(activeId).focus({ preventScroll: true }); try { if (cursor != null) byId(activeId).setSelectionRange(cursor, cursor); } catch {} }
  if (preserve) window.scrollTo(0, scroll);
}
function renderShell() { byId('topbar').innerHTML = renderTopbar(store, ui); byId('sidebar').innerHTML = renderNav(store, ui); byId('nav-dialog').innerHTML = renderNav(store, ui, true); saveIndicator(); }
function navigate(route, { edit = '', keepReturn = false } = {}) {
  if (!validRoutes.has(route)) return;
  ui.route = route; ui.editId = edit; ui.search = ''; ui.category = ''; ui.openImportance = false; ui.showArchived = edit ? Boolean(store.get(edit)?.archived) : false;
  if (!keepReturn) ui.returnContext = null;
  if (byId('nav-dialog').open) byId('nav-dialog').close();
  store.state.lastRoute = route; store.save();
  if (location.hash !== `#${route}`) history.replaceState(null, '', `#${route}`);
  renderShell(); renderMain(); window.scrollTo(0, 0); byId('main').focus({ preventScroll: true });
}
function routeFor(record) { return record.type === 'sources' ? 'sources' : record.type === 'iterations' ? 'reflection' : record.type === 'members' ? 'overview' : `step-${record.type === 'issues' && record.originStep === 7 ? 7 : TYPE_STEPS[record.type]}`; }
function invalidateChecks() { ui.checks = {}; byId('main').querySelectorAll('.check-result').forEach(element => element.remove()); byId('main').querySelectorAll('[data-action="review-step"]').forEach(element => element.remove()); }
function fieldDefinition(target, key) {
  if (target === 'focus') return getStep(2).fields.find(field => field.key === key);
  if (target.startsWith('step:')) return getStep(target.slice(5))?.fields?.find(field => field.key === key);
  const record = store.get(target); return record && sectionFor(record.type)?.fields.find(field => field.key === key);
}
function targetData(target) { return target === 'focus' ? store.focusData() : target === 'meta' ? store.state.meta : target === 'notes' ? store.state.notes : target === 'reflections' ? store.state.reflections : target.startsWith('step:') ? store.state.stepData[target.slice(5)] || {} : store.get(target)?.data || {}; }
function changeField(element) {
  const { target, key, kind } = element.dataset;
  if (!target || !key) return;
  const field = fieldDefinition(target, key); let value = element.value;
  if (kind === 'boolean') value = element.checked;
  if (kind === 'multi') value = toggleChoice(targetData(target)[key] || [], value, element.checked, field?.exclusive || []);
  if (kind === 'relation') value = field?.single ? [value] : toggleChoice(targetData(target)[key] || [], value, element.checked);
  store.setValue(target, key, value); invalidateChecks();
  if (target === 'meta' && key === 'title') { const name = document.querySelector('.project-name'); if (name) { name.textContent = value; name.title = value; } const heading = document.querySelector('.overview-hero h2'); if (heading) heading.textContent = value; }
  const counter = byId('main').querySelector(`[data-count-for="${element.id}"]`); if (counter) counter.textContent = textCount(value).label;
  if (kind) { renderMain(true); renderReference(); }
}
function confirmDialog(title, body, label, callback, danger = false) {
  confirmCallback = callback; const dialog = byId('confirm-dialog');
  dialog.innerHTML = `<div class="dialog-body"><h2 id="confirm-title">${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><div class="dialog-actions"><button class="button secondary" data-action="cancel-confirm">取消</button><button class="button ${danger ? 'danger' : 'primary'}" data-action="confirm">${escapeHtml(label)}</button></div></div>`;
  dialog.showModal(); dialog.querySelector('[data-action="cancel-confirm"]').focus();
}
function addRecord(type, origin, data = {}, parent = null) {
  const record = store.add(type, origin || TYPE_STEPS[type] || 0, data); invalidateChecks();
  if (parent) { const values = targetData(parent.target)[parent.key] || []; store.setValue(parent.target, parent.key, parent.single ? [record.id] : [...new Set([...values, record.id])]); ui.returnContext = { route: ui.route, edit: parent.target }; }
  navigate(routeFor(record), { edit: record.id, keepReturn: Boolean(parent) });
  setTimeout(() => byId(`record-${record.id}`)?.querySelector('input,textarea')?.focus(), 0);
  return record;
}
function locate(target, field, route) {
  const record = store.get(target); ui.openImportance = target === 'notes';
  navigate(record ? routeFor(record) : target === 'reflections' ? 'reflection' : target === 'meta' ? 'overview' : target.startsWith('step:') ? `step-${target.slice(5)}` : target === 'focus' || target === 'focusSelect' ? 'step-2' : route || ui.route, { edit: record?.id || '' });
  if (target === 'notes') { ui.openImportance = true; renderMain(); }
  const element = byId(fieldId(target, field)) || byId(`${fieldId(target, field)}-0`) || byId(target) || byId(`record-${target}`);
  if (element) { for (const details of byId('main').querySelectorAll('details')) if (details.contains(element)) details.open = true; element.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); (element.querySelector?.('input,textarea,button') || element).focus?.({ preventScroll: true }); }
}
document.addEventListener('input', event => {
  const element = event.target;
  if (element.matches('[data-relation-search]')) { const picker = element.closest('.picker-body'); let count = 0; picker.querySelectorAll('[data-search-text]').forEach(row => { row.hidden = !row.dataset.searchText.includes(element.value.trim().toLowerCase()); if (!row.hidden) count++; }); picker.querySelector('.picker-empty').hidden = count > 0; return; }
  if (element.id === 'record-search') { ui.search = element.value; clearTimeout(ui.searchTimer); ui.searchTimer = setTimeout(() => renderMain(true), 180); return; }
  if (element.matches('[data-target]') && !['checkbox', 'radio'].includes(element.type)) changeField(element);
});
document.addEventListener('change', event => {
  const element = event.target;
  if (element.id === 'show-archived') { ui.showArchived = element.checked; renderMain(true); return; }
  if (element.dataset.kind === 'focus') { store.setFocus(element.value); invalidateChecks(); renderMain(true); return; }
  if (element.matches('[data-target]') && ['checkbox', 'radio'].includes(element.type)) changeField(element);
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, id, type, route, step: stepNumber } = button.dataset;
  try {
    if (action === 'navigate') navigate(route);
    if (action === 'add') addRecord(type, Number(button.dataset.origin) || (ui.route === 'step-7' && type === 'issues' ? 7 : undefined));
    if (action === 'edit') { const record = store.get(id); if (record.archived) { ui.referenceId = id; renderReference(); return; } ui.editId = ui.editId === id ? '' : id; renderMain(true); }
    if (action === 'archive' || action === 'restore') { store.archive(id, action === 'archive'); invalidateChecks(); ui.editId = ''; renderShell(); renderMain(true); renderReference(); notice(action === 'archive' ? '记录已归档，可在“包含归档”中恢复。' : '记录已恢复，原有分析关联继续保留。'); }
    if (action === 'delete') confirmDialog('永久删除记录？', '已归档记录将永久删除。有引用或焦点历史的记录需要先处理关联。', '永久删除', () => { store.remove(id); invalidateChecks(); renderShell(); renderMain(true); renderReference(); }, true);
    if (action === 'category') { ui.category = button.dataset.category; renderMain(true); }
    if (action === 'reference') { previousReferenceFocus = document.activeElement; ui.referenceId = id; renderReference(); byId('reference').querySelector('h2').focus(); }
    if (action === 'close-reference') { ui.referenceId = ''; renderReference(); if (previousReferenceFocus?.isConnected) previousReferenceFocus.focus(); }
    if (action === 'jump-record') { const record = store.get(id); ui.referenceId = ''; renderReference(); navigate(routeFor(record), { edit: record.archived || ui.presentation ? '' : id }); if (record.archived) { ui.showArchived = true; renderMain(); } byId(`record-${id}`)?.scrollIntoView({ block: 'center' }); }
    if (action === 'unrelate') { const { target, key } = button.dataset; store.setValue(target, key, (targetData(target)[key] || []).filter(value => value !== id)); invalidateChecks(); renderMain(true); }
    if (action === 'new-related') addRecord(type, undefined, {}, { target: button.dataset.parent, key: button.dataset.key, single: button.dataset.single === 'true' });
    if (action === 'return-context') { const context = ui.returnContext; navigate(context.route, { edit: store.get(context.edit) ? context.edit : '' }); }
    if (action === 'assume-gap') addRecord('assumptions', 4, { gaps: [id] });
    if (action === 'resolve-gap') { const gap = store.get(id); addRecord('facts', 3, { title: gap.data.title || '' }, { target: id, key: 'resolvedFacts' }); notice('已创建待填写事实。填入证据后，返回缺口将调查进展改为“已补充”。'); }
    if (action === 'solve-issue') addRecord('solutions', 8, { issues: [id] });
    if (action === 'review-result') {
      const review = store.get(id); const kinds = { '新问题': 'issues', '新事实': 'facts', '新缺口': 'gaps' }; const resultType = kinds[review.data.kind];
      if (!resultType) { notice('此发现应修订已有记录，请通过关联记录进入原步骤。'); return; }
      const existing = (review.data.results || []).map(value => store.get(value)).find(record => record?.type === resultType);
      if (existing) { navigate(routeFor(existing), { edit: existing.id }); return; }
      const record = store.add(resultType, resultType === 'issues' ? 7 : 3, { title: review.data.title || '', description: review.data.description || '' }); store.update(id, 'results', [...(review.data.results || []), record.id]); invalidateChecks(); navigate(routeFor(record), { edit: record.id });
    }
    if (action === 'check-step' || action === 'review-step') { const number = Number(stepNumber); const result = validateStep(store, number); ui.checks[number] = result; if (action === 'review-step' && !result.errors.length) { markReviewed(store, number); notice('已记录人工复核确认；所引用材料改变后会提示待复核。'); } renderShell(); renderMain(true); if (result.errors.length) byId('main').querySelector('.check-result')?.scrollIntoView({ block: 'start' }); }
    if (action === 'locate') locate(button.dataset.target, button.dataset.field, route);
    if (action === 'backup') { backup(store); notice('项目备份已交给浏览器下载。实际截图需另行备份。'); }
    if (action === 'export-notes') { exportNotes(store); notice('已导出人工输入笔记，不包含自动撰写的报告正文。'); }
    if (action === 'import') { byId('import-file').value = ''; byId('import-file').click(); }
    if (action === 'new-project') confirmDialog('新建案例工作区？', '将先下载当前项目备份，再新建空白案例。实际截图文件不包含在备份中。', '备份并新建', () => { backup(store); const state = freshState(); state.meta.title = '未命名案例'; store.replace(state); ui.checks = {}; ui.referenceId = ''; renderReference(); navigate('overview'); });
    if (action === 'presentation') { ui.presentation = !ui.presentation; ui.editId = ''; renderShell(); renderMain(true); renderReference(); }
    if (action === 'theme') {
      ui.theme = applyTheme(document.documentElement, ui.theme === 'dark' ? 'light' : 'dark');
      const persisted = saveTheme(storage, ui.theme);
      button.outerHTML = renderThemeToggle(ui.theme); byId('theme-toggle').focus({ preventScroll: true });
      byId('live-status').textContent = `已切换到${ui.theme === 'dark' ? '深色' : '亮色'}模式。`;
      if (!persisted) notice('主题已切换，浏览器未能保存主题偏好。');
    }
    if (action === 'menu') { byId('nav-dialog').innerHTML = renderNav(store, ui, true); byId('nav-dialog').showModal(); }
    if (action === 'close-nav') byId('nav-dialog').close();
    if (action === 'cancel-confirm') { byId('confirm-dialog').close(); confirmCallback = null; }
    if (action === 'confirm') { const callback = confirmCallback; confirmCallback = null; byId('confirm-dialog').close(); callback?.(); }
  } catch (error) { notice(error.message, true); }
});
byId('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 5 * 1024 * 1024) throw new Error('备份超过 5 MB。'); const state = parseBackup(await file.text());
    confirmDialog('导入并替换当前项目？', `案例：${state.meta.title}；${state.records.length} 条记录。会先下载当前项目备份，再导入这份内容。`, '备份并导入', () => { backup(store); store.replace(state); ui.checks = {}; ui.referenceId = ''; renderReference(); navigate('overview'); notice('备份已导入。请在完成检查中核对关联与待复核事项。'); });
  } catch (error) { notice(`导入失败：${error.message} 当前工作未被替换。`, true); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && ui.referenceId && !byId('confirm-dialog').open && !byId('nav-dialog').open) { ui.referenceId = ''; renderReference(); previousReferenceFocus?.focus?.(); } });
window.addEventListener('hashchange', () => { const route = location.hash.slice(1); if (validRoutes.has(route)) navigate(route); });
window.addEventListener('pagehide', () => store.flush());
window.addEventListener('beforeunload', event => { store.flush(); if (store.saveStatus === 'failed' && store.state.records.length) { event.preventDefault(); event.returnValue = ''; } });
store.subscribe(() => { saveIndicator(); byId('sidebar').innerHTML = renderNav(store, ui); });
renderShell(); renderMain(); renderReference(); byId('boot-message').remove();
