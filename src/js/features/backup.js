import { download, safeFilename, fieldVisible } from '../core/utils.js';
import { STEPS } from './analysis/index.js';
import { sourceSection } from './sources.js';
import { memberSection, iterationSection, REFLECTIONS } from './reflection.js';
import { t, getLocale } from '../core/i18n.js';
export function backup(store) { store.flush(); if (store.recoveryRaw) download(store.recoveryRaw, '无法恢复的原本地数据.txt', 'text/plain;charset=utf-8'); download(JSON.stringify(store.state, null, 2), `${safeFilename(store.state.meta.title)}-项目备份.json`); }
export function readingNotes(store) {
  const state = store.state;
  const lines = [t('工程伦理分析笔记（人工输入原样整理）'), state.meta.title, t('小组：{group}', { group: state.meta.group || t('尚未填写') }), t('报告日期：{date}', { date: state.meta.date || t('尚未填写') }), t('导出时间：{time}', { time: new Date().toLocaleString(getLocale()) }), '', t('案例介绍'), state.meta.introduction || t('（尚未填写）'), '', t('AI 使用声明'), state.meta.aiStatement || t('（尚未填写）')];
  const append = (fields, data) => { for (const field of fields) {
    if (!fieldVisible(field, data)) continue;
    const value = data[field.key];
    if (value === undefined || value === '' || Array.isArray(value) && !value.length) continue;
    const rendered = Array.isArray(value) ? value.map(id => { const record = store.get(id); return record ? `${id} ${record.data.title || t('未命名')}${record.archived ? ` (${t('已归档')})` : ''}` : field.kind === 'multi' ? t(id) : id; }).join(' · ') : field.kind === 'single' ? t(value) : String(value);
    lines.push(`${t(field.label)}: ${rendered}`);
    if ((Array.isArray(value) ? value.includes('其他') : value === '其他') && data[`${field.key}Other`]) lines.push(`${t('自定义：')}${data[`${field.key}Other`]}`);
  } };
  for (const step of STEPS) {
    lines.push('', t(`步骤 ${step.number} · ${step.title}`), step.english);
    if (step.number === 2) { lines.push(t('焦点：{id} {title}', { id: state.focusId, title: store.get(state.focusId)?.data.title || t('尚未选择') })); append(step.fields, store.focusData()); }
    else append(step.fields || [], state.stepData[step.number] || {});
    for (const section of step.sections) {
      lines.push(t(section.title));
      for (const record of store.records(section.type).filter(item => !section.filterOrigin || item.originStep === section.filterOrigin)) { lines.push(`${record.id} · ${record.data.title || t('未命名记录')}`); append(section.fields, record.data); }
    }
    if (step.number === 7) for (const issue of store.records('issues').filter(record => record.originStep === 7)) { lines.push(t('复核新增问题：{id} {title}', { id: issue.id, title: issue.data.title || '' }), issue.data.description || ''); }
    for (const [key, label] of [['noGapsReason', '未发现信息缺口的理由'], ['noAssumptionsReason', '无需假设的理由']]) if (state.stepData[step.number]?.[key]) lines.push(`${t(label)}: ${state.stepData[step.number][key]}`);
    lines.push(t('本步骤的重要性：'), state.notes[step.number] || t('（尚未填写）'));
  }
  for (const section of [sourceSection, memberSection, iterationSection]) { lines.push('', t(section.title)); for (const record of store.records(section.type)) { lines.push(record.id); append(section.fields, record.data); } }
  REFLECTIONS.forEach((question, index) => lines.push('', t(question), state.reflections[index] || t('（尚未填写）')));
  lines.push('', t('此文件不是自动生成的课程报告。请按 LaTeX 模板自行撰写并核对引用、贡献、反思及提交材料。'));
  return lines.join('\n');
}
export function exportNotes(store) { download(readingNotes(store), `${safeFilename(store.state.meta.title)}-分析笔记.txt`, 'text/plain;charset=utf-8'); }
