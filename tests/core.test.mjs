import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, freshState, parseBackup, STORAGE_KEY } from '../src/js/core/store.js';
import { reviewStatus, markReviewed } from '../src/js/core/review.js';
import { toggleChoice, safeFilename, safeUrl, escapeHtml } from '../src/js/core/utils.js';
import { validateStep, validateProject } from '../src/js/core/validation.js';
import { STEPS, getStep } from '../src/js/features/analysis/index.js';
import { scientificSources } from '../src/js/features/sources.js';
import { readingNotes } from '../src/js/features/backup.js';
import { bundleSingleHtml } from '../scripts/build.mjs';
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), data }; };
const makeStore = () => new Store(memory());
test('all ten steps have interactive schemas, including review, solutions and future', () => {
  assert.deepEqual(STEPS.map(step => step.number), [1,2,3,4,5,6,7,8,9,10]);
  assert(getStep(7).fields.length && getStep(7).sections[0].fields.length);
  assert(getStep(8).sections[0].fields.some(field => field.key === 'short'));
  assert(getStep(10).sections[0].fields.some(field => field.key === 'governance'));
});
test('exclusive options clear concrete choices; concrete options clear exclusives', () => {
  assert.deepEqual(toggleChoice(['生命与健康'], '尚不确定', true, ['尚不确定']), ['尚不确定']);
  assert.deepEqual(toggleChoice(['尚不确定'], '生命与健康', true, ['尚不确定']), ['生命与健康']);
  assert.deepEqual(toggleChoice(['生命与健康'], '生命与健康', false), []);
});
test('focus changes preserve independent reasons', () => {
  const store = makeStore(); const a = store.add('issues'); const b = store.add('issues');
  store.setFocus(a.id); store.setValue('focus', 'causeReason', 'Reason A');
  store.setFocus(b.id); store.setValue('focus', 'causeReason', 'Reason B');
  store.setFocus(a.id); assert.equal(store.focusData().causeReason, 'Reason A'); store.flush();
});
test('conditional principle reasons survive switching and only active branch appears in notes', () => {
  const store = makeStore(); const record = store.add('principles', 6, { title: 'Test principle', applicability: '适用', applicableReason: 'ACTIVE_A' });
  store.update(record.id, 'applicability', '不纳入'); store.update(record.id, 'excludedReason', 'ACTIVE_B');
  assert.equal(store.get(record.id).data.applicableReason, 'ACTIVE_A');
  const notes = readingNotes(store); assert(notes.includes('ACTIVE_B')); assert(!notes.includes('ACTIVE_A'));
  const restored = parseBackup(JSON.stringify(store.state)); assert.equal(restored.records[0].data.applicableReason, 'ACTIVE_A'); store.flush();
});
test('source updates invalidate transitive dependent reviews without rewriting analysis', () => {
  const store = makeStore(); const source = store.add('sources'); const fact = store.add('facts', 3, { sources: [source.id] }); const assumption = store.add('assumptions', 4, { evidence: [fact.id], statement: 'UNCHANGED' });
  markReviewed(store, 4); assert.equal(reviewStatus(store.state, 4), '已复核');
  store.update(source.id, 'title', 'New evidence'); assert.equal(reviewStatus(store.state, 4), '待复核'); assert.equal(assumption.data.statement, 'UNCHANGED');
  markReviewed(store, 4); assert.equal(reviewStatus(store.state, 4), '已复核'); store.flush();
});
test('cyclic record references have a finite review fingerprint', () => {
  const store = makeStore(); const solution = store.add('solutions'); const constraint = store.add('constraints', 9, { solutions: [solution.id] }); store.update(solution.id, 'constraints', [constraint.id]);
  markReviewed(store, 9); assert.equal(reviewStatus(store.state, 9), '已复核'); store.update(solution.id, 'short', 'Changed'); assert.equal(reviewStatus(store.state, 9), '待复核'); store.flush();
});
test('referenced archived records cannot be permanently deleted and restoration preserves links', () => {
  const store = makeStore(); const source = store.add('sources'); const fact = store.add('facts', 3, { sources: [source.id] });
  store.archive(source.id); assert.throws(() => store.remove(source.id), /引用/);
  store.archive(source.id, false); assert.deepEqual(fact.data.sources, [source.id]); store.flush();
});
test('JSON backup restores all records, branches and reviewed fingerprints', () => {
  const storage = memory(); const store = new Store(storage); const term = store.add('terms', 5, { title: 'Test', definition: 'manual' }); store.archive(term.id); store.state.notes[5] = 'manual'; markReviewed(store, 5); store.flush();
  const restored = new Store(storage); assert.deepEqual(restored.state, store.state); assert.equal(reviewStatus(restored.state, 5), '已复核');
});
test('malformed backup values and prototype keys are rejected', () => {
  const invalid = freshState(); invalid.stepData[2] = null; assert.throws(() => parseBackup(JSON.stringify(invalid)));
  const state = freshState(); state.records.push({ id: 'ISS-001', type: 'issues', data: { title: true }, originStep: 1, version: 1, archived: false }); assert.throws(() => parseBackup(JSON.stringify(state)));
  assert.throws(() => parseBackup('{"__proto__":{"polluted":true}}'));
});
test('failed persistence retains memory and corrupt prior content is not overwritten', () => {
  const storage = { getItem: () => '{broken', setItem: () => assert.fail('must not overwrite corrupt prior state') }; const store = new Store(storage); store.add('issues'); store.flush();
  assert.equal(store.saveStatus, 'failed'); assert.equal(store.state.records.length, 1); assert.equal(store.recoveryRaw, '{broken');
  const failed = new Store({ getItem: () => null, setItem: () => { throw new Error('Quota'); } }); failed.add('facts'); failed.flush(); assert.equal(failed.saveStatus, 'failed'); assert.equal(failed.records('facts').length, 1);
});
test('three chosen names or terms without substantive content do not pass minima', () => {
  const store = makeStore(); ['A','B','C'].forEach(title => store.add('stakeholders', 1, { title })); ['A','B','C'].forEach(title => store.add('terms', 5, { title }));
  assert(validateStep(store, 1).errors.some(item => item.message.includes('3 类')));
  assert(validateStep(store, 5).errors.some(item => item.message.includes('3 个'))); store.flush();
});
test('archived evidence generates a visible broken-association error', () => {
  const store = makeStore(); const gap = store.add('gaps'); const assumption = store.add('assumptions', 4, { gaps: [gap.id] }); store.archive(gap.id);
  assert(validateStep(store, 4).errors.some(item => item.target === assumption.id && item.message.includes('已归档'))); store.flush();
});
test('scientific candidates deduplicate DOI and do not include course/background sources', () => {
  const store = makeStore(); store.add('sources', 0, { title: 'A', category: '科学文献', intended: '是', doi: '10.123/ABC' }); store.add('sources', 0, { title: 'B', category: '科学文献', intended: '是', doi: 'https://doi.org/10.123/abc' }); store.add('sources', 0, { title: 'C', category: '课程材料', intended: '是' });
  assert.equal(scientificSources(store).length, 1); store.flush();
});
test('review findings and added issues appear in reading export, independently of keywords', () => {
  const store = makeStore(); store.add('reviews', 7, { title: 'REVIEW_SENTINEL', description: 'Manual discovery', status: '待处理' }); store.add('issues', 7, { title: 'NEW_ISSUE_SENTINEL', description: 'Manual new issue' }); store.add('terms', 5, { title: 'Term', clarification: 'TERM_SENTINEL' });
  const notes = readingNotes(store); for (const sentinel of ['REVIEW_SENTINEL', 'NEW_ISSUE_SENTINEL', 'TERM_SENTINEL']) assert(notes.includes(sentinel)); store.flush();
});
test('Chinese filenames remain useful and untrusted values cannot become HTML or executable URLs', () => {
  assert.equal(safeFilename('挑战者号事故'), '挑战者号事故'); assert(!escapeHtml('<img onerror="x">').includes('<img')); assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://example.com'), 'https://example.com/');
});
test('project checklist includes all 10 steps, three reflections and at least 10 sources', () => {
  const groups = validateProject(makeStore()); assert.equal(groups.length, 11); assert(groups[10].errors.some(item => item.message.includes('反思问题 3'))); assert(groups[10].errors.some(item => item.message.includes('至少需要 10 条')));
});
test('release build inlines all styles and scripts without generating dist', async () => {
  const result = await bundleSingleHtml(); assert(result.modules >= 20); assert(!result.html.includes('type="module"')); assert(!/<link rel="stylesheet"/.test(result.html)); assert(!/<script[^>]+src=/.test(result.html)); assert(result.html.includes('工程伦理工作台'));
});
