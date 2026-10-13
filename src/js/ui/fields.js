import { escapeHtml, textCount, fieldVisible } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
export const TYPE_LABELS = { issues: '问题', stakeholders: '群体', facts: '事实', gaps: '缺口', assumptions: '假设', terms: '术语', principles: '原则', conflicts: '冲突', reviews: '复核发现', solutions: '方案', constraints: '约束', future: '未来情景', sources: '来源', members: '成员', iterations: '迭代' };
export function fieldId(target, key) { return `field-${target.replace(/[^a-zA-Z0-9-]/g, '-')}-${key}`; }
export function renderField(store, field, data, target, readOnly = false) {
  if (!fieldVisible(field, data)) return '';
  const value = data[field.key], id = fieldId(target, field.key), label = escapeHtml(t(field.label));
  const attributes = `data-target="${escapeHtml(target)}" data-key="${field.key}"`;
  if (readOnly) {
    if (value === undefined || value === '' || Array.isArray(value) && !value.length) return '';
    let rendered;
    if (field.kind === 'relation') rendered = (value || []).map(recordId => {
      const record = store.get(recordId);
      return `<button class="reference-chip" data-action="reference" data-id="${escapeHtml(recordId)}">${escapeHtml(`${recordId} ${record?.data.title || t('未命名')}`)}${record?.archived ? ` · ${t('已归档')}` : ''}</button>`;
    }).join(' ');
    else if (field.kind === 'multi') rendered = value.map(option => escapeHtml(t(option))).join(' · ');
    else rendered = escapeHtml(field.kind === 'single' ? t(value) : value);
    const other = (Array.isArray(value) ? value.includes('其他') : value === '其他') && data[`${field.key}Other`];
    return `<div class="read-field"><span class="field-label">${label}</span><div class="read-text">${rendered}${other ? `<p>${t('自定义：')}${escapeHtml(other)}</p>` : ''}</div></div>`;
  }
  let control = '';
  if (field.kind === 'single' || field.kind === 'multi') {
    const selected = Array.isArray(value) ? value : [value], multi = field.kind === 'multi';
    control = `<div class="choices" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="${id}-label">${field.options.map((option, index) => `<label class="choice"><input type="${multi ? 'checkbox' : 'radio'}" id="${id}-${index}" name="${id}" value="${escapeHtml(option)}" ${attributes} data-kind="${field.kind}" ${selected.includes(option) ? 'checked' : ''}><span>${escapeHtml(t(option))}</span></label>`).join('')}</div>`;
    if (selected.includes('其他') && !(field.key === 'category' && ['问题分类', '约束分类'].includes(field.label))) {
      const otherId = fieldId(target, `${field.key}Other`);
      control += `<div class="conditional-field"><label for="${otherId}">${t('其他内容')}</label><input id="${otherId}" data-target="${escapeHtml(target)}" data-key="${field.key}Other" value="${escapeHtml(data[`${field.key}Other`] || '')}" placeholder="${t('自行补充具体内容')}"></div>`;
    }
  } else if (field.kind === 'relation') {
    const selected = Array.isArray(value) ? value : [];
    const candidates = store.state.records.filter(record => field.types.includes(record.type) && (!record.archived || selected.includes(record.id)));
    const selectedRecords = selected.map(recordId => {
      const record = store.get(recordId);
      const name = record ? `${recordId} ${record.data.title || t('未命名')}${record.archived ? ` (${t('已归档')})` : ''}` : `${recordId} (${t('失效关联')})`;
      return `<span class="relation-item"><button class="reference-chip" data-action="reference" data-id="${escapeHtml(recordId)}">${icon('link')}${escapeHtml(name)}</button><button class="remove-chip" data-action="unrelate" data-target="${escapeHtml(target)}" data-key="${field.key}" data-id="${escapeHtml(recordId)}" aria-label="${escapeHtml(t('移除关联 {id}', { id: recordId }))}">${icon('close')}</button></span>`;
    }).join('');
    control = `<div class="selected-relations">${selectedRecords}</div><details class="relation-picker" id="${id}"><summary>${icon('link')} ${t(selected.length ? '修改关联' : '选择关联记录')} <span class="subtle">${t(field.single ? '单选' : '多选')}</span></summary><div class="picker-body"><input type="search" placeholder="${t('搜索编号或标题')}" aria-label="${escapeHtml(t('搜索{item}', { item: t(field.label) }))}" data-relation-search><div class="picker-options">${candidates.map(record => `<label class="picker-option" data-search-text="${escapeHtml(`${record.id} ${record.data.title || ''}`.toLowerCase())}"><input type="${field.single ? 'radio' : 'checkbox'}" name="${id}-relation" ${attributes} data-kind="relation" value="${record.id}" ${selected.includes(record.id) ? 'checked' : ''}><span><strong>${escapeHtml(record.data.title || t('未命名记录'))}</strong><small>${record.id} · ${t(TYPE_LABELS[record.type])}${record.archived ? ` · ${t('已归档')}` : ''}</small></span></label>`).join('') || `<p class="subtle">${t('还没有可选记录，请先新增。')}</p>`}</div><p class="picker-empty" hidden>${t('没有找到匹配记录。')}</p><div class="picker-add">${field.types.map(type => `<button class="text-button" data-action="new-related" data-type="${type}" data-parent="${escapeHtml(target)}" data-key="${field.key}" ${field.single ? 'data-single="true"' : ''}>${icon('plus')} ${t('新增{item}', { item: t(TYPE_LABELS[type]) })}</button>`).join('')}</div></div></details>`;
  } else {
    const counter = field.kind === 'textarea' ? `<small class="word-count" data-count-for="${id}">${textCount(value).label}</small>` : '';
    control = field.kind === 'textarea'
      ? `<textarea id="${id}" ${attributes} placeholder="${t('写明具体内容与依据')}">${escapeHtml(value || '')}</textarea>${counter}`
      : `<input id="${id}" ${attributes} value="${escapeHtml(value || '')}" ${field.suggestions ? `list="${id}-suggestions"` : ''} placeholder="${t(field.suggestions ? '选择常见候选或直接输入自定义内容' : '请填写')}">${field.suggestions ? `<datalist id="${id}-suggestions">${field.suggestions.map(option => `<option value="${escapeHtml(t(option))}"></option>`).join('')}</datalist>` : ''}`;
  }
  return `<div class="field" data-field-target="${escapeHtml(target)}" data-field-key="${field.key}"><div class="field-label" id="${id}-label">${['text', 'textarea'].includes(field.kind) ? `<label for="${id}">${label}</label>` : `<span>${label}</span>`}<span class="${field.required ? 'required' : 'optional'}-label">${t(field.required ? '必填' : '可选')}</span></div>${control}</div>`;
}
export function renderFields(store, fields, data, target, readOnly = false) {
  let paired = false;
  return fields.map(field => {
    if (!field.column) return renderField(store, field, data, target, readOnly);
    if (paired) return ''; paired = true;
    return `<div class="paired-fields">${[['short', '短期行动'], ['long', '长期改进']].map(([column, title]) => `<div><h3>${t(title)}</h3>${fields.filter(item => item.column === column).map(item => renderField(store, item, data, target, readOnly)).join('')}</div>`).join('')}</div>`;
  }).join('');
}
