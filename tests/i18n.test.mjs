import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage, t, LANGUAGE_KEY, readLanguage, saveLanguage } from '../src/js/core/i18n.js';
import { STEPS } from '../src/js/features/analysis/index.js';
import { sourceSection } from '../src/js/features/sources.js';
import { memberSection, iterationSection, REFLECTIONS } from '../src/js/features/reflection.js';
import { Store, parseBackup } from '../src/js/core/store.js';
import { markReviewed, reviewStatus } from '../src/js/core/review.js';
import { renderFields } from '../src/js/ui/fields.js';
import { renderCheckResult } from '../src/js/ui/pages.js';
import { readingNotes } from '../src/js/features/backup.js';
import { validateStep } from '../src/js/core/validation.js';
afterEach(() => setLanguage('zh-CN'));
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }; };
test('all ten step schemas, field labels, choices, suggestions and reflection questions have English resources', () => {
  setLanguage('en'); const strings = new Set(REFLECTIONS);
  const addFields = fields => fields.forEach(field => [field.label, ...(field.options || []), ...(field.suggestions || [])].forEach(value => strings.add(value)));
  for (const step of STEPS) { [step.title, step.goal, step.prompt].forEach(value => strings.add(value)); addFields(step.fields || []); step.sections.forEach(section => { [section.title, section.singular, section.hint].filter(Boolean).forEach(value => strings.add(value)); addFields(section.fields); }); }
  [sourceSection, memberSection, iterationSection].forEach(section => { strings.add(section.title); strings.add(section.singular); addFields(section.fields); });
  const missing = [...strings].filter(value => /[\u3400-\u9fff]/.test(t(value)));
  assert.deepEqual(missing, []);
});
test('English labels keep canonical Chinese selection values and leave user text untouched', () => {
  setLanguage('en'); const store = new Store(memory());
  const record = store.add('principles', 6, { title: '适用', applicability: '适用', applicableReason: '专业责任原文，不应翻译' });
  const html = renderFields(store, STEPS[5].sections[0].fields, record.data, record.id);
  assert(html.includes('Applicable')); assert(html.includes('value="适用"')); assert(html.includes('专业责任原文，不应翻译'));
  const readonly = renderFields(store, STEPS[5].sections[0].fields, record.data, record.id, true);
  assert(readonly.includes('专业责任原文，不应翻译')); assert(readonly.includes('Applicable')); store.flush();
});
test('switching language does not change project state, review fingerprints or validation results', () => {
  const store = new Store(memory()); store.add('issues', 1, { title: '用户问题', category: '公司相关', description: '用户分析' }); markReviewed(store, 1);
  const backup = JSON.stringify(store.state), before = validateStep(store, 1);
  setLanguage('en'); assert.equal(JSON.stringify(store.state), backup); assert.equal(reviewStatus(store.state, 1), '已复核'); assert.deepEqual(validateStep(store, 1), before);
  assert.deepEqual(parseBackup(backup), store.state); store.flush();
});
test('dynamic validation messages are localized without changing identifiers', () => {
  setLanguage('en'); const store = new Store(memory()); const result = validateStep(store, 3);
  const html = renderCheckResult(result, 'step-3'); assert(!/[\u3400-\u9fff]/.test(html));
  assert(t('“相关来源”存在失效关联：SRC-003，请处理。').includes('SRC-003'));
  assert(t('案例：用户中文案例；3 条记录。会先下载当前项目备份，再导入这份内容。').includes('用户中文案例'));
});
test('language preference is independent of case backups and tolerates unavailable storage', () => {
  const storage = memory(); setLanguage('en'); assert.equal(saveLanguage(storage), true); assert.equal(storage.getItem(LANGUAGE_KEY), 'en'); assert.equal(readLanguage(storage), 'en');
  assert.equal(readLanguage({ getItem() { throw Error('Unavailable'); } }), 'zh-CN'); assert.equal(saveLanguage(null), false);
});
test('English notes localize headings and options while preserving original analytical text', () => {
  const store = new Store(memory()); store.add('issues', 1, { title: '中文问题原名', category: '公司相关', description: '用户原始推理' });
  setLanguage('en'); const notes = readingNotes(store); assert(notes.includes('Engineering ethics analysis notes')); assert(notes.includes('Company-related')); assert(notes.includes('中文问题原名')); assert(notes.includes('用户原始推理')); store.flush();
});
