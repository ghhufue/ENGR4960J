import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Store, parseBackup } from '../src/js/core/store.js';
import { setLanguage, t } from '../src/js/core/i18n.js';
import { markReviewed, reviewStatus } from '../src/js/core/review.js';
import { validateStep, validateProject } from '../src/js/core/validation.js';
import { reflectionQuestions, supportsReflection } from '../src/js/features/reflection-guidance.js';
import { readingNotes } from '../src/js/features/backup.js';
import { renderStep } from '../src/js/ui/pages.js';
import { renderField } from '../src/js/ui/fields.js';
import { STEPS } from '../src/js/features/analysis/index.js';
const makeStore = () => { const data = new Map(); return new Store({ getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }); };
const has = (questions, condition) => questions.some(item => item.condition.includes(condition));
afterEach(() => setLanguage('zh-CN'));

test('reflection uses actual group records and bilingual keywords instead of claiming to assess quality', () => {
  const store = makeStore(), issue = store.add('issues', 1, { description: '' });
  assert.equal(reflectionQuestions(store, issue.id, 'description').length, 1);
  store.update(issue.id, 'description', 'Safety risk must be discussed.');
  assert(has(reflectionQuestions(store, issue.id, 'description'), '安全或风险'));
  const groups = ['A', 'B', 'C'].map(title => store.add('stakeholders', 1, { title }));
  store.update(issue.id, 'stakeholders', groups.map(group => group.id));
  const questions = reflectionQuestions(store, issue.id, 'description');
  assert(!has(questions, '少于三类')); assert(!has(questions, '尚未关联有效的利益相关者'));
  store.update(issue.id, 'description', '这里涉及安全风险。'); assert(has(reflectionQuestions(store, issue.id, 'description'), '安全或风险'));
  store.flush();
});

test('archived and invalid links do not suppress missing-evidence prompts', () => {
  const store = makeStore(), source = store.add('sources'), fact = store.add('facts', 3, { statement: 'An assertion needing verification.', sources: [source.id], verification: '已核查' });
  assert(!has(reflectionQuestions(store, fact.id, 'statement'), '尚未关联有效来源'));
  store.archive(source.id); assert(has(reflectionQuestions(store, fact.id, 'statement'), '尚未关联有效来源'));
  store.update(fact.id, 'sources', ['SRC-999']); assert(has(reflectionQuestions(store, fact.id, 'statement'), '尚未关联有效来源'));
  store.flush();
});

test('cross-step reflection uses live gaps, investigation decisions and open review actions', () => {
  const store = makeStore(); store.add('gaps'); store.add('facts'); store.add('reviews');
  const before = reflectionQuestions(store, 'step:7', 'scopeReason');
  assert(has(before, '已有信息缺口')); assert(has(before, '未核查')); assert(has(before, '未完成'));
  store.setValue('step:4', 'noAssumptionsReason', 'Investigate first; no assumption is needed.');
  assert(!has(reflectionQuestions(store, 'step:7', 'scopeReason'), '已有信息缺口')); store.flush();
});

test('alternative assumptions and short/long solutions change the offered follow-up questions', () => {
  const store = makeStore(), assumption = store.add('assumptions', 4, { statement: 'A provisional assumption.' });
  assert(has(reflectionQuestions(store, assumption.id, 'statement'), '假设不成立'));
  store.update(assumption.id, 'opposite', 'Revisit the conclusion if false.');
  assert(!has(reflectionQuestions(store, assumption.id, 'statement'), '假设不成立'));
  const solution = store.add('solutions', 8, { short: 'Temporarily pause the operation.' });
  assert(has(reflectionQuestions(store, solution.id, 'short'), '长期改进'));
  store.update(solution.id, 'long', 'Change the review process.');
  assert(!has(reflectionQuestions(store, solution.id, 'short'), '尚未填写长期改进')); store.flush();
});

test('reflection does not alter analysis, review status or exports and readonly fields omit the controls', () => {
  const store = makeStore(), record = store.add('issues', 1, { description: '<img src=x onerror=alert(1)>' });
  markReviewed(store, 1); store.flush(); const before = JSON.stringify(store.state);
  const questions = reflectionQuestions(store, record.id, 'description'); assert.equal(JSON.stringify(store.state), before); assert.equal(reviewStatus(store.state, 1), '已复核');
  assert(!readingNotes(store).includes(questions[0].question));
  const field = STEPS[0].sections[0].fields.find(item => item.key === 'description');
  const edit = renderField(store, field, record.data, record.id); assert(edit.includes('data-action="reflect-answer"')); assert(!edit.includes('<img'));
  assert(!renderField(store, field, record.data, record.id, true).includes('reflect-answer'));
  assert.equal(supportsReflection(store, record.id, 'title'), false);
  store.archive(record.id); assert.deepEqual(reflectionQuestions(store, record.id, 'description'), []); store.flush();
});

test('all ten steps omit importance inputs and gates while legacy notes survive backup and export', () => {
  const store = makeStore(); store.state.notes[1] = 'LEGACY_IMPORTANCE'; store.state.notes[5] = 'x';
  const ui = { route: 'step-1', checks: {}, presentation: false };
  for (const step of STEPS) {
    const html = renderStep(store, step, ui);
    assert(!html.includes('importance-section')); assert(!html.includes('data-target="notes"'));
    const result = validateStep(store, step.number); assert(!result.errors.some(item => item.target === 'notes')); assert(!result.warnings.some(message => message.includes('重要性说明')));
  }
  assert.equal(parseBackup(JSON.stringify(store.state)).notes[1], 'LEGACY_IMPORTANCE');
  assert(readingNotes(store).includes('LEGACY_IMPORTANCE'));
  store.state.notes = {}; assert(!readingNotes(store).includes('本步骤的重要性：'));
  store.add('issues', 1, { category: '公司相关', title: 'A', description: 'Manual analysis.' });
  ['A', 'B', 'C'].forEach(title => store.add('stakeholders', 1, { title, impact: 'Manual impact.' }));
  assert.equal(validateStep(store, 1).errors.length, 0);
  assert(validateProject(store).at(-1).warnings.some(message => message.includes('另行撰写'))); store.flush();
});

test('reflection prompts are localized across supported fields and preserve original user content', () => {
  const store = makeStore(), targets = [
    ['issues', 'description', { description: '安全风险' }], ['stakeholders', 'impact', { impact: 'x' }],
    ['facts', 'statement', { statement: 'x' }], ['gaps', 'description', { description: 'x' }],
    ['assumptions', 'statement', { statement: 'x' }], ['terms', 'clarification', { clarification: 'x' }],
    ['principles', 'excludedReason', { excludedReason: 'x', applicability: '不纳入' }],
    ['conflicts', 'resolution', { resolution: 'x', approach: '优先满足某项原则' }],
    ['reviews', 'description', { description: 'x' }], ['solutions', 'short', { short: 'x' }],
    ['solutions', 'long', { long: 'x' }], ['solutions', 'reason', { reason: 'x' }],
    ['constraints', 'description', { description: 'x' }], ['future', 'scenario', { scenario: 'x' }]
  ];
  const records = targets.map(([type, key, data]) => ({ record: store.add(type, 1, data), key }));
  store.setFocus(records[0].record.id); store.setValue('focus', 'causeReason', 'x'); store.setValue('focus', 'causality', '尚不确定');
  const before = JSON.stringify(store.state); setLanguage('en');
  const entries = [...records.map(({ record, key }) => [record.id, key]), ['focus', 'causeReason'], ['step:7', 'scopeReason']];
  for (const [target, key] of entries) for (const prompt of reflectionQuestions(store, target, key)) {
    assert(!/[\u3400-\u9fff]/.test(t(prompt.condition)), prompt.condition);
    assert(!/[\u3400-\u9fff]/.test(t(prompt.question)), prompt.question);
  }
  assert.equal(JSON.stringify(store.state), before); store.flush();
});
