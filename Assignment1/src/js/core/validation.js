import { getStep, STEPS } from '../features/analysis/index.js';
import { fieldVisible, hasValue, textCount } from './utils.js';
import { scientificSources } from '../features/sources.js';
export function validateFields(store, fields, data, target) {
  const errors = [];
  for (const field of fields) {
    if (!fieldVisible(field, data)) continue;
    if (field.required && !hasValue(data[field.key])) errors.push({ target, field: field.key, message: `请填写或选择“${field.label}”。` });
    if (field.kind === 'single' && hasValue(data[field.key]) && !field.options.includes(data[field.key])) errors.push({ target, field: field.key, message: `“${field.label}”包含未定义的选项，请重新选择。` });
    if (field.kind === 'multi' && (data[field.key] || []).some(value => !field.options.includes(value))) errors.push({ target, field: field.key, message: `“${field.label}”包含未定义的选项，请重新选择或使用其他内容。` });
    if (field.kind === 'relation' && field.single && (data[field.key]?.length || 0) > 1) errors.push({ target, field: field.key, message: `“${field.label}”只能选择一个对象。` });
    if (field.kind === 'relation') for (const id of data[field.key] || []) {
      const record = store.get(id);
      if (!record || record.archived || !field.types.includes(record.type)) errors.push({ target, field: field.key, message: `“${field.label}”存在${record?.archived ? '已归档' : '失效'}关联：${id}，请处理。` });
    }
    if ((Array.isArray(data[field.key]) ? data[field.key].includes('其他') : data[field.key] === '其他') && field.kind !== 'relation' && !(field.key === 'category' && ['问题分类', '约束分类'].includes(field.label)) && !hasValue(data[`${field.key}Other`])) errors.push({ target, field: `${field.key}Other`, message: `请补充“${field.label}”中的其他内容。` });
  }
  return errors;
}
function error(message, target = 'step', field = '') { return { message, target, field }; }
export function validateStep(store, number) {
  const step = getStep(number); const errors = []; const warnings = []; const data = store.state.stepData[number] || {};
  if (!step) return { errors: [error('未知步骤。')], warnings };
  errors.push(...validateFields(store, step.fields || [], number === 2 ? store.focusData() : data, number === 2 ? 'focus' : `step:${number}`));
  for (const section of step.sections) {
    const records = store.records(section.type).filter(record => !section.filterOrigin || record.originStep === section.filterOrigin);
    for (const record of records) errors.push(...validateFields(store, section.fields, record.data, record.id));
  }
  if (number === 1) {
    if (!store.records('issues').some(record => record.originStep === 1)) errors.push(error('请至少登记一个伦理问题。'));
    const groups = store.records('stakeholders').filter(record => record.data.title?.trim() && record.data.impact?.trim());
    const unique = new Set(groups.map(record => record.data.title.replace(/\s/g, '').toLowerCase()));
    if (unique.size < 3) errors.push(error('至少需要 3 类不同利益相关者，每类都应填写具体影响。'));
  }
  if (number === 2) {
    const focus = store.get(store.state.focusId);
    if (!focus || focus.archived || focus.type !== 'issues') errors.push(error('请从有效问题中选定分析焦点。', 'focusSelect'));
    if (store.focusData().causality === '尚不确定') errors.push(error('因果关系尚不确定，请补充材料后再确认复核。', 'focus', 'causality'));
  }
  if (number === 3) {
    const categories = ['一般', '物质与技术', '个人相关', '组织相关'];
    categories.forEach((category, index) => {
      if (data[`category${index}`] === '尚未检查') errors.push(error(`尚未检查${category}事实。`, 'step:3', `category${index}`));
      if (data[`category${index}`] === '有相关事实' && !store.records('facts').some(record => record.data.category === category)) errors.push(error(`尚未登记${category}事实。`));
    });
    if (Object.values(data).includes('经检查未发现') && !data.categoryNotes?.trim()) errors.push(error('请说明未发现相关事实的检查范围与理由。', 'step:3', 'categoryNotes'));
    if (!store.records('gaps').length && !data.noGapsReason?.trim()) errors.push(error('没有信息缺口时，请说明检查范围与理由。', 'step:3', 'noGapsReason'));
    store.records('facts').forEach(record => { if (record.data.verification === '已核查' && !record.data.sources?.length) errors.push(error('标为已核查的事实需关联来源。', record.id, 'sources')); if (record.data.verification !== '已核查') warnings.push(`${record.id} 仍未核查或存在争议。`); });
  }
  if (number === 4 && !store.records('assumptions').length && !data.noAssumptionsReason?.trim()) errors.push(error('无需采用假设时，请说明原因。', 'step:4', 'noAssumptionsReason'));
  if (number === 5) {
    const terms = store.records('terms').filter(record => ['title', 'definition', 'clarification', 'relevance'].every(key => hasValue(record.data[key])));
    if (new Set(terms.map(record => record.data.title.replace(/\s/g, '').toLowerCase())).size < 3) errors.push(error('至少需要 3 个不同且内容完整的术语。'));
  }
  if (number === 6) {
    if (!store.state.meta.principlesComplete || !store.records('principles').length) errors.push(error('请录入课程原则清单并人工确认完整。', 'meta', 'principlesComplete'));
    store.records('principles').forEach(record => { if (record.data.applicability === '待讨论') errors.push(error('该原则仍待讨论。', record.id, 'applicability')); });
    if (data.conflictStatus === '尚不确定') errors.push(error('原则冲突判断尚不确定。', 'step:6', 'conflictStatus'));
    if (data.conflictStatus === '发现冲突' && !store.records('conflicts').length) errors.push(error('请登记发现的冲突及处理方式。'));
    store.records('conflicts').forEach(record => {
      if ((record.data.principles?.length || 0) + (record.data.otherInterest?.trim() ? 1 : 0) < 2) errors.push(error('冲突应涉及至少两个原则或利益对象。', record.id, 'principles'));
      if (record.data.approach === '尚未形成处理意见') errors.push(error('冲突尚未形成处理意见。', record.id, 'approach'));
    });
  }
  if (number === 7) {
    store.records('issues').filter(record => record.originStep === 7).forEach(record => errors.push(...validateFields(store, getStep(1).sections[0].fields, record.data, record.id)));
    if (Object.values(data).includes('尚未检查')) errors.push(error('请完成各方向的人工复核。'));
    if (Object.values(data).includes('发现需处理事项') && !store.records('reviews').length) errors.push(error('请记录发现的遗漏与后续行动。'));
    store.records('reviews').filter(record => ['待处理', '处理中'].includes(record.data.status)).forEach(record => warnings.push(`${record.id} 的行动尚未完成。`));
  }
  if (number === 8) {
    if (!store.records('issues').length) errors.push(error('请先登记伦理问题。'));
    for (const issue of store.records('issues')) if (!store.records('solutions').some(record => record.data.issues?.includes(issue.id)) && !issue.data.deferredReason?.trim()) errors.push(error(`${issue.id} 尚无方案，请补充方案或说明暂缓理由。`, issue.id, 'deferredReason'));
  }
  if (number === 9) {
    const categories = ['技术与工程', '监管与法律', '文化环境', '其他'];
    categories.forEach((category, index) => {
      if (data[`category${index}`] === '尚未检查') errors.push(error(`尚未检查${category}约束。`, 'step:9', `category${index}`));
      if (data[`category${index}`] === '有相关约束' && !store.records('constraints').some(record => record.data.category === category)) errors.push(error(`请登记${category}约束。`));
    });
    if (Object.values(data).includes('经检查未发现') && !data.categoryNotes?.trim()) errors.push(error('请说明未发现约束的检查范围与理由。', 'step:9', 'categoryNotes'));
  }
  if (number === 10) {
    if (!store.records('future').length) errors.push(error('请登记未来可能出现的新伦理问题与预防措施。'));
    store.records('future').forEach(record => { if (record.data.otherTypes?.length && !record.data.otherTypes.includes('无额外措施') && !record.data.other?.trim()) errors.push(error('选择其他措施方向后，请补充具体措施。', record.id, 'other')); });
  }
  return { errors, warnings: [...new Set(warnings)] };
}
export function validateProject(store) {
  const groups = STEPS.map(step => ({ title: `步骤 ${step.number} · ${step.title}`, route: `step-${step.number}`, ...validateStep(store, step.number) }));
  const errors = []; const warnings = [];
  for (const [key, label] of [['title', '案例名称'], ['group', '小组编号'], ['date', '报告日期'], ['introduction', '案例介绍'], ['aiStatement', 'AI 使用声明']]) if (!hasValue(store.state.meta[key])) errors.push(error(`请补充${label}。`, 'meta', key));
  const intro = textCount(store.state.meta.introduction);
  if (intro.chinese) warnings.push('案例介绍含中文，100 words 的计算口径需人工核对。'); else if (intro.words > 100) errors.push(error('案例介绍超过 100 words。', 'meta', 'introduction'));
  if (!store.records('members').length) errors.push(error('请登记成员和贡献。'));
  store.records('members').forEach(record => { if (!record.data.title?.trim() || !record.data.contribution?.trim()) errors.push(error('成员姓名与贡献说明尚不完整。', record.id)); });
  store.state.reflections.forEach((answer, i) => { const count = textCount(answer); if (!answer.trim()) errors.push(error(`请完成反思问题 ${i + 1}。`, 'reflections', String(i))); else if (count.chinese) warnings.push(`反思 ${i + 1} 的中文字数口径需人工核对。`); else if (count.words !== 150) errors.push(error(`反思 ${i + 1} 应为 150 words。`, 'reflections', String(i))); });
  const sources = scientificSources(store);
  if (sources.length < 10) errors.push(error(`拟用于报告的不同科学文献候选目前 ${sources.length} 条，至少需要 10 条。`));
  sources.filter(record => record.data.cited !== '已在正文引用').forEach(record => errors.push(error(`${record.id} 尚未确认已在报告正文引用。`, record.id, 'cited')));
  if (!store.records('iterations').length) warnings.push('尚未登记开发迭代；请另外保存实际全部 AI 交互截图。');
  warnings.push('APA 7 格式、科学文献适用性、报告排版与 AI 使用边界仍需人工核对。截图索引不包含实际图片。');
  warnings.push('步骤重要性说明请在课程报告中按模板另行撰写。');
  groups.push({ title: '报告与提交材料', route: 'overview', errors, warnings }); return groups;
}
