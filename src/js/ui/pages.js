import { escapeHtml } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { STEPS, getStep } from '../features/analysis/index.js';
import { area, text } from '../features/analysis/fields.js';
import { reviewStatus } from '../core/review.js';
import { validateStep, validateProject } from '../core/validation.js';
import { sourceSection, scientificSources } from '../features/sources.js';
import { memberSection, iterationSection, REFLECTIONS } from '../features/reflection.js';
import { renderFields } from './fields.js';
import { renderSection } from './records.js';
import { icon } from './icons.js';
import { renderThemeToggle } from './theme-control.js';
import { renderLanguageToggle } from './language-control.js';
const statusClass = { '未开始': 'neutral', '进行中': 'accent', '已复核': 'success', '待复核': 'warning' };
const tr = source => escapeHtml(t(source));
export function statusBadge(status) {
  return `<span class="badge ${statusClass[status] || 'neutral'}">${icon(status === '已复核' ? 'check' : status === '待复核' ? 'alert' : status === '进行中' ? 'clock' : 'circle')}${tr(status)}</span>`;
}
export function pageHead(title, english, description, extra = '') {
  return `<div class="page-heading"><div class="eyebrow">ENGR4960J / ${tr('分析工作区')}</div><div class="page-title-row"><h1>${tr(title)}</h1>${extra}</div><p class="english-title">${escapeHtml(english)}</p><p class="page-description">${tr(description)}</p></div>`;
}
export function toolbar(ui, placeholder = '搜索当前记录') {
  return ui.presentation ? '' : `<div class="list-toolbar"><label class="search-field">${icon('search')}<input type="search" id="record-search" placeholder="${tr(placeholder)}" aria-label="${tr(placeholder)}" value="${escapeHtml(ui.search || '')}"></label><label class="archive-toggle"><input type="checkbox" id="show-archived" ${ui.showArchived ? 'checked' : ''}> ${tr('包含归档')}</label></div>`;
}
export function renderOverview(store, ui) {
  const statuses = STEPS.map(step => reviewStatus(store.state, step.number));
  const done = statuses.filter(status => status === '已复核').length;
  const workModeTitle = ui.collaborating ? '协作工作方式' : '本地工作方式';
  const workModeMessage = ui.collaborating ? '已提交内容保存在小组后端并同步给组员；未提交草稿保存在当前浏览器。截图文件需另外整理。' : '内容保存在当前浏览器。换设备前请导出项目备份，截图文件需另外整理。';
  return `${pageHead('案例概览', 'CASE WORKSPACE', '从事实出发，让每一步伦理判断都有依据。')}
    <section class="overview-hero"><div><span class="badge neutral">${tr('工程伦理 · 十步案例分析')}</span><h2>${escapeHtml(store.state.meta.title)}</h2><p>${tr('整理问题、核查材料、讨论取舍。工作台记录你的分析过程，判断由小组自己作出。')}</p><button class="button primary" data-action="navigate" data-route="step-1">${tr('开始分析')} ${icon('arrow')}</button></div>
    <div class="progress-summary"><span class="progress-number">${done}<small> / 10</small></span><span>${tr('步骤已人工复核')}</span><div class="progress-track"><span style="width:${done * 10}%"></span></div><small>${t('{count} 步待复核 · {sources} 条科学文献候选', { count: statuses.filter(status => status === '待复核').length, sources: scientificSources(store).length })}</small></div></section>
    <div class="overview-columns"><section class="content-section"><div class="section-heading"><h2>${tr('分析路径')}</h2><span class="subtle">${tr('可随时返回任一步骤')}</span></div><div class="step-overview">${STEPS.map(step => `<button class="step-overview-row" data-action="navigate" data-route="step-${step.number}"><span class="step-number">${String(step.number).padStart(2, '0')}</span><span><strong>${tr(step.title)}</strong><small>${tr(step.goal)}</small></span>${statusBadge(reviewStatus(store.state, step.number))}${icon('arrow')}</button>`).join('')}</div></section>
    <section class="background-panel"><div class="eyebrow">${tr('案例背景材料')}</div><h2>Challenger Space Shuttle Accident</h2><p>${tr('仓库简介描述了 1986 年挑战者号事故、低温下 O-ring 密封问题以及发射决策中的工程意见与进度压力。')}</p><p class="source-note">${tr('来源：')}ref/case-description.txt<br>${tr('这是背景简介，尚未自动转为已核查事实。')}</p><div class="info-note">${tr('先核查具体事实和时间线，再形成责任或因果判断。')}</div><h3>${tr(workModeTitle)}</h3><p>${tr(workModeMessage)}</p><button class="button secondary" data-action="backup">${icon('download')} ${tr('导出项目备份')}</button></section></div>
    <section class="content-section"><div class="section-heading"><h2>${tr('案例与报告信息')}</h2></div>${renderFields(store, [text('title', '案例名称'), text('group', '小组编号'), text('date', '报告日期'), area('introduction', '案例介绍（不超过 100 words）'), area('aiStatement', 'AI 使用声明')], store.state.meta, 'meta', ui.presentation)}<p class="subtle">${tr('报告文字由组员自行撰写；中文 words 计数口径请按课程要求确认。')}</p></section>${renderSection(store, memberSection, ui)}`;
}
function focusPanel(store, step, ui) {
  const records = store.records('issues');
  return `<section class="content-section"><div class="section-heading"><h2>${tr('选择分析焦点')}</h2><span class="subtle">${tr('保留每个问题的历史理由')}</span></div><div class="focus-options" id="focusSelect">${records.map(record => `<label class="focus-option"><input type="radio" name="focus" value="${record.id}" data-kind="focus" ${store.state.focusId === record.id ? 'checked' : ''} ${ui.presentation ? 'disabled' : ''}><span><strong>${escapeHtml(record.data.title || t('尚未命名的问题'))}</strong><small>${record.id} · ${escapeHtml(record.data.description || t('尚无描述'))}</small></span></label>`).join('') || `<div class="empty-state"><p>${tr('先到步骤 1 记录伦理问题，再选择分析焦点。')}</p><button class="button secondary" data-action="navigate" data-route="step-1">${tr('前往步骤 1')}</button></div>`}</div>${store.state.focusId ? `<div class="form-fields">${renderFields(store, step.fields, store.focusData(), 'focus', ui.presentation)}</div>` : ''}</section>`;
}
function coveragePanel(store, ui) {
  return `<section class="content-section"><div class="section-heading"><h2>${tr('问题覆盖检查')}</h2></div>${['原始问题', '复核新增问题'].map((heading, index) => `<h3 class="coverage-heading">${tr(heading)}</h3>${store.records('issues').filter(record => index ? record.originStep === 7 : record.originStep !== 7).map(record => {
    const solutions = store.records('solutions').filter(solution => solution.data.issues?.includes(record.id));
    return `<div class="coverage-row"><span><strong>${escapeHtml(record.data.title || t('未命名问题'))}</strong><small>${record.id} · ${solutions.length ? t('{count} 个候选方案', { count: solutions.length }) : tr('尚无方案')}</small></span><button class="text-button" data-action="solve-issue" data-id="${record.id}">${icon('plus')} ${tr('为问题新增方案')}</button>${!solutions.length ? `<details class="coverage-defer"><summary>${tr('暂缓处理说明')}</summary>${renderFields(store, [area('deferredReason', '暂缓处理的具体理由', false)], record.data, record.id, ui.presentation)}</details>` : ''}</div>`;
  }).join('') || `<p class="subtle">${tr('暂无该类问题。')}</p>`}`).join('')}</section>`;
}
function stepExtras(store, step, ui) {
  const number = step.number, data = store.state.stepData[number] || {}; let html = '';
  if (number === 2) html += focusPanel(store, step, ui);
  if (number === 3 && !store.records('gaps').length) html += renderFields(store, [area('noGapsReason', '未发现信息缺口时的检查范围与理由')], data, 'step:3', ui.presentation);
  if (number === 4 && !store.records('assumptions').length) html += renderFields(store, [area('noAssumptionsReason', '无需采用假设的理由')], data, 'step:4', ui.presentation);
  if (number === 6) html += `<div class="info-note">${tr('课程原则清单需依据教材或课堂材料填写，不以通用原则替代。')}</div>${ui.presentation ? `<p>${tr('清单完整性：')}${tr(store.state.meta.principlesComplete ? '已人工确认' : '尚未确认')}</p>` : `<label class="confirmation-row"><input type="checkbox" id="field-meta-principlesComplete" data-target="meta" data-key="principlesComplete" data-kind="boolean" ${store.state.meta.principlesComplete ? 'checked' : ''}> ${tr('我已对照课程材料，确认下面的原则清单完整')}</label>`}`;
  if (number === 7) {
    const previous = STEPS.slice(0, 6).map(item => ({ item, result: validateStep(store, item.number) }));
    html += `<details class="guidance"><summary>${tr('前 6 步的结构检查提示')}</summary><div>${previous.map(({ item, result }) => `<div class="review-recap"><button class="text-button" data-action="navigate" data-route="step-${item.number}">${item.number}. ${tr(item.title)} ${icon('arrow')}</button><p>${t('{errors} 项待补 · {warnings} 项需人工注意', { errors: result.errors.length, warnings: result.warnings.length })}</p></div>`).join('')}<p class="subtle">${tr('这里不是伦理分析质量评分；请结合原记录自行复核。')}</p></div></details>`;
  }
  if (number === 8) html += coveragePanel(store, ui);
  return html;
}
export function renderStep(store, step, ui) {
  const number = step.number, status = reviewStatus(store.state, number), result = ui.checks[number];
  let html = `${pageHead(step.title, `STEP ${String(number).padStart(2, '0')} / ${step.english}`, step.goal, statusBadge(status))}${status === '待复核' ? `<div class="warning-note">${tr('本步记录或所引用的材料已经修改。请查看相关内容，再重新检查并确认。')}</div>` : ''}<details class="guidance"><summary>${tr('思考提示')}</summary><p>${tr(step.prompt)}</p></details>`;
  if (result) html += renderCheckResult(result, `step-${number}`);
  if (step.fields?.length && number !== 2) html += `<section class="content-section"><div class="section-heading"><h2>${tr(number === 7 ? '逐项复核' : '本步判断')}</h2></div>${renderFields(store, step.fields, store.state.stepData[number] || {}, `step:${number}`, ui.presentation)}</section>`;
  html += stepExtras(store, step, ui);
  if (step.sections.length) html += toolbar(ui);
  html += step.sections.map(section => renderSection(store, section, ui)).join('');
  if (number === 7) html += renderSection(store, { ...getStep(1).sections[0], title: '复核新增伦理问题', singular: '新增伦理问题', filterOrigin: 7 }, ui);
  html += `<section class="content-section"><details class="importance-section" ${store.state.notes[number] || ui.openImportance ? 'open' : ''}><summary>${tr(number === 4 ? '本步目的与个人备注（可选）' : '本步骤的重要性说明')}<span class="subtle">${number >= 5 ? '50–100 words' : tr(number === 4 ? '模板未要求另写字数' : '无固定字数')}</span></summary><div>${number === 4 ? `<p class="subtle">${tr('信息不足时，需依据已有事实、专业经验和推理作出明确区分的合理假设。')}</p>` : ''}${renderFields(store, [area(String(number), '由组员说明这一步为什么重要', number !== 4)], store.state.notes, 'notes', ui.presentation)}</div></details></section>`;
  html += `<footer class="step-footer"><button class="button secondary" data-action="navigate" data-route="${number === 1 ? 'overview' : `step-${number - 1}`}">${icon('back')} ${tr(number === 1 ? '案例概览' : '上一步')}</button><div class="inline-actions">${!ui.presentation ? `<button class="button ${result && !result.errors.length ? 'secondary' : 'primary'}" data-action="check-step" data-step="${number}">${tr('检查本步')}</button>${result && !result.errors.length ? `<button class="button primary" data-action="review-step" data-step="${number}">${icon('check')} ${tr('标记已复核')}</button>` : ''}` : ''}<button class="button secondary" data-action="navigate" data-route="${number === 10 ? 'checks' : `step-${number + 1}`}">${tr(number === 10 ? '完成检查' : '下一步')} ${icon('arrow')}</button></div></footer>`;
  return html;
}
export function renderCheckResult(result, route = '') {
  return `<section class="check-result ${result.errors.length ? 'has-errors' : 'is-complete'}" aria-label="${tr('字段完整性检查结果')}"><h2>${icon(result.errors.length ? 'alert' : 'check')}${result.errors.length ? t('{count} 项内容需要补充', { count: result.errors.length }) : tr('字段检查通过，请人工复核')}</h2>${result.errors.length ? `<ul>${result.errors.map(item => `<li>${tr(item.message)}${item.target !== 'step' ? `<button class="text-button" data-action="locate" data-route="${route}" data-target="${escapeHtml(item.target)}" data-field="${escapeHtml(item.field || '')}">${tr('定位')} ${icon('arrow')}</button>` : ''}</li>`).join('')}</ul>` : `<p>${tr('检查只说明所需字段齐全，不代表事实或伦理结论已被系统验证。')}</p>`}${result.warnings.length ? `<details><summary>${t('{count} 项仍需人工注意', { count: result.warnings.length })}</summary><ul>${result.warnings.map(warning => `<li>${tr(warning)}</li>`).join('')}</ul></details>` : ''}</section>`;
}
export function renderSources(store, ui) {
  return `${pageHead('来源库', 'SOURCES & EVIDENCE', '把分析判断与资料关联起来，保留核查状态。')}<div class="info-note">${t('已登记 {count} 条来源；其中 {candidates} 条为去重后的报告科学文献候选。请另行核对 APA 7 及正文引用。', { count: store.records('sources').length, candidates: scientificSources(store).length })}</div>${toolbar(ui, '搜索标题、作者、DOI 或编号')}${renderSection(store, sourceSection, ui)}`;
}
export function renderReflection(store, ui) {
  return `${pageHead('过程与反思', 'PROCESS & SELF-REFLECTION', '记录迭代、设计取舍，以及 AI 如何参与工作。')}<div class="info-note">${tr('此处只登记截图文件索引。提交时仍需附上实际所有 AI 交互截图；反思回答由组员自行撰写。')}</div>${toolbar(ui)}${renderSection(store, iterationSection, ui)}<section class="content-section"><div class="section-heading"><h2>${tr('三个自我反思问题')}</h2><span class="subtle">${tr('每题 150 words')}</span></div>${REFLECTIONS.map((question, index) => renderFields(store, [area(String(index), t('问题 {number} · {question}', { number: index + 1, question: t(question) }))], store.state.reflections, 'reflections', ui.presentation)).join('')}</section>`;
}
export function renderChecks(store, ui) {
  const groups = validateProject(store);
  return `${pageHead('完成检查', 'REVIEW & HANDOFF', '对照模板检查输入完整性，人工核对分析与最终提交材料。')}<div class="info-note">${tr('“字段齐全”与“已人工复核”分别显示。报告、PPT 和实际截图仍需按课程要求另外完成。')}</div><div class="check-summary"><div><strong>${groups.reduce((sum, group) => sum + group.errors.length, 0)}</strong><span>${tr('项待补内容')}</span></div><div><strong>${STEPS.filter(step => reviewStatus(store.state, step.number) === '已复核').length}<small>/10</small></strong><span>${tr('步已人工复核')}</span></div><div><strong>${scientificSources(store).length}<small>/10</small></strong><span>${tr('科学文献候选')}</span></div></div>${groups.map((group, index) => `<section class="content-section"><div class="section-heading"><h2>${tr(group.title)}</h2>${index < 10 ? statusBadge(reviewStatus(store.state, index + 1)) : ''}<button class="text-button" data-action="navigate" data-route="${group.route}">${tr('打开')} ${icon('arrow')}</button></div>${renderCheckResult(group, group.route)}</section>`).join('')}<div class="inline-actions"><button class="button primary" data-action="backup">${icon('download')} ${tr('导出完整项目备份')}</button><button class="button secondary" data-action="export-notes">${tr('导出人工分析笔记')}</button></div><p class="subtle">${tr('分析笔记原样整理已输入内容，不生成报告正文，也不替代 LaTeX 报告。')}</p>`;
}
export function renderTopbar(store, ui) {
  return `<div class="brand-lockup"><button class="icon-button mobile-menu" data-action="menu" aria-label="${tr('打开分析导航')}">${icon('menu')}</button><span class="brand-icon">${icon('layers')}</span><span class="brand-name">${tr('工程伦理工作台')}</span><span class="brand-divider"></span><span class="project-name" title="${escapeHtml(store.state.meta.title)}">${escapeHtml(store.state.meta.title)}</span></div><div class="topbar-actions"><span id="save-status" class="save-status"></span><details class="action-menu project-menu"><summary class="button secondary" aria-label="${tr('备份与导入')}">${icon('download')} <span class="action-label">${tr('备份与导入')}</span></summary><div class="menu-panel"><button data-action="backup">${tr('导出项目备份 JSON')}</button><button data-action="import">${tr('从备份导入')}</button><button data-action="export-notes">${tr('导出人工分析笔记 TXT')}</button><button data-action="new-project">${tr('新建案例')}</button></div></details><button class="button secondary" data-action="presentation" aria-label="${tr(ui.presentation ? '退出展示' : '展示模式')}">${icon('screen')} <span class="action-label">${tr(ui.presentation ? '退出展示' : '展示模式')}</span></button>${renderLanguageToggle()}${renderThemeToggle(ui.theme)}</div>`;
}
export function renderWorkspaceStatus(sync = {}) {
  let label = '本地工作区', detail = t('内容由组员分析 · 浏览器保存'), tone = 'local';
  if (sync.status === 'connecting') { label = '正在连接服务器'; detail = t('正在验证访问权限'); tone = 'active'; }
  else if (sync.enabled) {
    label = '已连接服务器'; tone = 'connected';
    const progress = { pending: '待同步', syncing: '同步中', conflict: '待人工裁定', synced: '已同步' };
    detail = t('项目 {project} · {status}', { project: sync.projectId, status: t(progress[sync.status] || '待同步') });
    if (sync.status === 'conflict') tone = 'warning';
    if (sync.status === 'pending' || sync.status === 'syncing') tone = 'active';
    if (sync.status === 'offline') { label = '离线 · 等待重连'; detail = t('草稿已保留 · 恢复后自动同步'); tone = 'warning'; }
    if (sync.status === 'blocked') { label = '同步受阻'; detail = t('草稿已保留 · 请打开协作处理'); tone = 'error'; }
    if (sync.cacheError || sync.store?.saveStatus === 'failed') { detail = t('本地缓存失败 · 请导出备份'); tone = 'error'; }
  } else if (sync.error) { label = '连接失败'; detail = t('尚未连接 · 浏览器保存'); tone = 'error'; }
  return `<span class="workspace-dot ${tone}" aria-hidden="true"></span> ${tr(label)}<span class="workspace-detail">${escapeHtml(detail)}</span>`;
}
export function renderNav(store, ui, mobile = false, sync = {}) {
  const nav = (route, label, symbol) => `<button class="nav-item ${ui.route === route ? 'active' : ''}" data-action="navigate" data-route="${route}" ${ui.route === route ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${tr(label)}</span></button>`;
  return `${mobile ? `<div class="drawer-heading"><strong>${tr('分析导航')}</strong><button class="icon-button" data-action="close-nav" aria-label="${tr('关闭导航')}">${icon('close')}</button></div>` : ''}<div class="workspace-label"><span class="workspace-avatar">E</span><div><strong>ENGR4960J</strong><small>${escapeHtml(store.state.meta.group ? t('小组 {group}', { group: store.state.meta.group }) : t('工程伦理案例分析'))}</small></div></div>${nav('overview', '案例概览', 'grid')}<div class="nav-group-label">${tr('十步分析')} <span>${STEPS.filter(step => reviewStatus(store.state, step.number) === '已复核').length}/10</span></div><nav class="steps-nav">${STEPS.map(step => {
    const status = reviewStatus(store.state, step.number);
    return `<button class="nav-item step-nav ${ui.route === `step-${step.number}` ? 'active' : ''}" data-action="navigate" data-route="step-${step.number}" ${ui.route === `step-${step.number}` ? 'aria-current="step"' : ''}><span class="nav-number">${String(step.number).padStart(2, '0')}</span><span class="nav-title">${tr(step.title)}</span><span class="nav-status ${statusClass[status]}" title="${tr(status)}" aria-label="${tr(status)}">${icon(status === '已复核' ? 'check' : status === '待复核' ? 'alert' : status === '进行中' ? 'clock' : 'circle')}</span></button>`;
  }).join('')}</nav><div class="nav-group-label">${tr('材料与提交')}</div>${nav('sources', '来源库', 'book')}${nav('reflection', '过程与反思', 'clock')}${nav('checks', '完成检查', 'shield')}<div class="sidebar-bottom" data-workspace-status role="status">${renderWorkspaceStatus(sync)}</div>`;
}
