import { createProject, schemas, sections, readings, normalizeProject, exportNotes } from './project.js';

const storageKey = 'engr4960j.assignment2.responsibility.v1';
const main = document.querySelector('main');
const editor = document.querySelector('#editor');
const form = document.querySelector('#editor-form');
const editorBody = document.querySelector('#editor-body');
const editorActions = document.querySelector('#editor-actions');
const errorMessage = document.querySelector('#editor-error');
const importFile = document.querySelector('#import-file');
const robotArt = document.querySelector('#robot-illustration').innerHTML;

const iconPaths = {
  case: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
  actors: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1"/>',
  models: '<path d="M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  gaps: '<path d="M8 4H5v5m11-5h3v5M5 15v5h3m11-5v5h-3"/><path d="M10 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.2 1-1.2 1.6m0 3h.01"/>',
  results: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8m-8 5 2 2 5-5"/>',
  evidence: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
  causal: '<circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="m8 11 8-5m-8 7 8 5"/>',
  hierarchy: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4m-6 4v-4h12v4"/>',
  future: '<path d="M4 12h15m-6-6 6 6-6 6"/>'
};
const modelViews = [
  { id: 'causal', label: 'Causal', icon: 'causal', question: 'How did the delayed command contribute to harm?', prompt: 'Connect specific events and explain how each link operates. Record what would change the chain. Consider foreseeability and practical control separately when judging blame.' },
  { id: 'organization', label: 'Hierarchy & organization', icon: 'hierarchy', question: 'Who knew, approved, and could intervene?', prompt: 'Compare formal authority with practical control. Trace the handoffs among the hospital, manufacturer, and network provider, then record who should explain the outcome and to whom.' },
  { id: 'future', label: 'Forward-looking', icon: 'future', question: 'Who should investigate, respond, and prevent recurrence?', prompt: 'Write an action with a proposed owner, the authority and resources they need, a trigger or deadline, and a concrete completion check.' }
];
const mapTones = {
  Supported: 'supported', Contested: 'contested', 'Not established': 'neutral', Unassessed: 'unknown',
  'Teacher brief': 'supported', 'Simulated material': 'contested', 'Group hypothesis': 'purple', 'Open question': 'unknown',
  Proposed: 'contested', Agreed: 'neutral', 'In progress': 'purple', Verified: 'supported', 'Sequence only': 'purple'
};
const displayStatus = value => value === 'Teacher brief' ? 'Case Fact' : value;
const phaseOrder = schemas.events.fields.find(field => field.key === 'phase').choices;
const active = group => project[group].filter(item => !item.archived);
const find = (group, id) => project[group].find(item => item.id === id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
const notice = document.querySelector('#notice');
let noticeTimer;
let project = createProject();
let editorState;
let showArchived = false;
let evidenceStatus = '';
let actionStage = '';
let actorFocus = '';

function saveStatus(message, error = false) {
  const status = document.querySelector('#save-status');
  status.textContent = message;
  status.dataset.error = String(error);
}

try {
  const draft = localStorage.getItem(storageKey);
  if (draft) {
    project = normalizeProject(JSON.parse(draft));
    saveStatus('Saved locally');
  }
} catch {
  saveStatus('Draft unavailable · export a backup', true);
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(project));
    saveStatus('Saved locally');
  } catch {
    saveStatus('Save unavailable · export a backup', true);
  }
}

function announce(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
}

function route() {
  const [id, subview] = location.hash.slice(1).split('/');
  return {
    section: sections.find(section => section.id === id) ?? sections[0],
    model: modelViews.find(model => model.id === subview) ?? modelViews[0]
  };
}

function pill(value) {
  const teal = ['Teacher brief', 'Supported', 'Verified', 'Agreed'];
  const amber = ['Group hypothesis', 'Open question', 'To obtain', 'Simulated material', 'Contested', 'Insufficient information', 'Apparent gap', 'Proposed', 'Archived'];
  const tone = teal.includes(value) ? 'teal' : amber.includes(value) ? 'amber' : '';
  return `<span class="pill" data-tone="${tone}">${escape(displayStatus(value))}</span>`;
}

function editButton(group, id, label = 'Edit', className = 'secondary') {
  return `<button class="button ${className}" type="button" data-edit="${group}" data-id="${escape(id)}">${escape(label)}</button>`;
}

function heading(title, description = '', action = '') {
  return `<div class="section-head"><div><h2>${escape(title)}</h2>${description ? `<p>${escape(description)}</p>` : ''}</div>${action}</div>`;
}

function chips(group, ids) {
  if (!ids.length) return '';
  const buttons = ids.map(id => {
    const item = find(group, id);
    const label = group === 'evidence' ? item.id : item.title;
    return `<button class="ref-chip" type="button" data-edit="${group}" data-id="${item.id}" title="${escape(item.title)}" aria-label="${escape(item.id + ' · ' + item.title)}${item.archived ? ' (archived)' : ''}">${escape(label)}${item.archived ? ' (archived)' : ''}</button>`;
  });
  return `<div class="links">${buttons.join('')}</div>`;
}

function endpoints(group, item) {
  const connector = item.kind === 'Sequence only' ? 'then' : '→';
  return `<div class="edge">${chips(group, [item.from])}<span>${connector}</span>${chips(group, [item.to])}</div>`;
}

function recordRow(group, item, body, tags = [], refs = '') {
  return `<article class="record-row">
    <div class="row-content"><div class="inline"><span class="record-id">${item.id}</span>${tags.map(pill).join('')}${item.archived ? pill('Archived') : ''}</div>
    <h3>${escape(item.title)}</h3>${body}${refs}</div>${editButton(group, item.id, 'Edit', 'quiet')}
  </article>`;
}

const line = value => value ? `<p class="plain">${escape(value)}</p>` : '';
const empty = message => `<p class="note">${escape(message)}</p>`;
const list = (rows, message) => rows.length ? `<div class="row-list">${rows.join('')}</div>` : empty(message);
const visible = group => showArchived ? project[group] : active(group);
const actorMatches = ids => !actorFocus || ids.includes(actorFocus);

function pathStrip() {
  const items = ['T01', 'T02', 'T03', 'T04', 'T05'].map(id => find('events', id)).filter(item => item && !item.archived);
  if (items.length !== 5) return empty('Review the recorded events in the case timeline.');
  return `<div class="path-strip">${items.map(item => `
    <button class="path-node" data-edit="events" data-id="${item.id}" type="button"><span>${item.id}</span><strong>${escape(item.title)}</strong></button>`).join('')}</div>`;
}

function renderCase() {
  const gap = active('gaps')[0];
  const timeline = [...visible('events')].sort((a, b) => phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase));
  const reconstructions = timeline.filter(item => item.status === 'Simulated material');
  const caseEvents = timeline.filter(item => item.status !== 'Simulated material');
  const eventRows = items => list(items.map(item => recordRow('events', item,
    line(item.time) + line(item.detail), [item.phase, item.status], chips('actors', item.actors) + chips('evidence', item.evidence))), 'No events recorded.');
  return `<section class="hero" aria-labelledby="page-title">
    <div class="hero-copy"><p class="eyebrow">CASE 01 / ENGINEERING ETHICS</p><h1 id="page-title">${escape(project.caseInfo.title)}</h1>
    <p>${escape(project.caseInfo.description)}</p>
    <div class="hero-actions"><a class="button primary" href="#models/causal">Explore responsibility maps ${icon('future')}</a>${editButton('caseInfo', '', 'Edit case summary', 'quiet')}
    <button class="button quiet" type="button" data-command="example">Load group example</button></div></div>
    ${robotArt}<span class="hero-caption" aria-hidden="true">FIG. 01 · SCHEMATIC</span>
  </section>
  <section class="section summary-grid case-overview" aria-label="Case at a glance">
    <div class="panel">${heading('Incident at a glance', 'Sequence from the original hypothetical case.')}${pathStrip()}</div>
    <div class="panel gap-callout"><p class="eyebrow">OPEN RESPONSIBILITY QUESTION</p><h3>${escape(gap?.title || 'Review the allocation of duties')}</h3>
    <a class="text-link" href="#gaps">Investigate the gap →</a></div>
  </section>
  <section class="section">${heading('Three lenses on the same incident', 'Use one set of actors and evidence to build separate arguments.')}
    <div class="cards">${modelViews.map((model, index) => `<a class="card model-card" data-model="${model.id}" href="#models/${model.id}">
      <div class="card-top"><span class="icon-box">${icon(model.icon)}</span><span class="record-id">0${index + 1} ↗</span></div>
      <h3>${model.label}</h3><p>${model.question}</p></a>`).join('')}</div>
  </section>
  <section class="section">${heading('Harm and open questions')}
    <div class="summary-grid"><article class="panel"><h3>Harm and affected parties</h3>${line(project.caseInfo.harm)}</article>
    <article class="panel"><h3>Open questions</h3>${line(project.caseInfo.questions)}</article></div>
  </section>
  <section class="section">${heading('Case timeline', 'The original case facts and open questions are listed here.', editButton('events', '', '+ Add event'))}
    ${eventRows(caseEvents)}
  </section>
  ${reconstructions.length ? `<section class="section">${heading('Detailed reconstruction (assumed)', 'The group’s simulated timeline is drawn from report assumptions A1–A10.')}${eventRows(reconstructions)}</section>` : ''}`;
}

function renderActors() {
  const actors = visible('actors');
  return `<div class="note">Record technical components alongside people and organizations. Use the human and organizational records to examine duties, knowledge, and practical control.</div>
    <section class="section">${heading('Actors and system components', 'Open a record to compare what an actor knew, what they were authorized to do, and what they could actually do.', editButton('actors', '', '+ Add actor'))}
    ${list(actors.map(item => recordRow('actors', item, line(item.role) + line(item.position), [item.kind], chips('evidence', item.evidence))), 'No actors recorded.')}</section>
    ${renderRelations(false)}`;
}

function hasCaseFactBasis(ids) {
  return ids.length > 0 && ids.every(id => {
    const source = find('evidence', id);
    return !source.archived && source.status === 'Teacher brief';
  });
}

function renderMap(title, labels, groups, edges) {
  if (!edges.length) return `<section class="section panel">${heading(title)}${empty('Add or show records to draw connections.')}</section>`;

  const endpoints = ['from', 'to'].map(key => [...new Set(edges.map(edge => edge[key]))]);
  const rows = Math.max(...endpoints.map(ids => ids.length));
  const height = rows * 68;
  const positions = endpoints.map(ids => new Map(ids.map((id, index) => [id, (index + .5) * height / ids.length])));
  const paths = edges.map(edge => {
    const start = positions[0].get(edge.from);
    const end = positions[1].get(edge.to);
    return `<path class="map-path${edge.dashed ? ' dashed' : ''}" data-tone="${mapTones[edge.status]}" d="M0 ${start} C43 ${start}, 55 ${end}, 95 ${end}" marker-end="url(#map-arrow)"><title>${escape(edge.id + ' · ' + edge.title + ' · ' + displayStatus(edge.status))}</title></path>`;
  });
  const columns = endpoints.map((ids, column) => `<div class="map-column">${ids.map(id => {
    if (!id) return '<span class="map-node map-unassigned">Unassigned</span>';
    const group = groups[column];
    const item = find(group, id);
    const label = `${id} · ${item.title}${item.archived ? ' (archived)' : ''}`;
    return `<button type="button" class="map-node" data-edit="${group}" data-id="${id}" title="${escape(label)}" aria-label="${escape(label)}">
      <span class="record-id">${id}${item.archived ? ' · Archived' : ''}</span><strong>${escape(item.title)}</strong>
    </button>`;
  }).join('')}</div>`);
  const legend = [...new Set(edges.map(edge => edge.status))].map(status =>
    `<span><i class="map-swatch" data-tone="${mapTones[status]}" aria-hidden="true"></i>${escape(displayStatus(status))}</span>`);
  if (edges.some(edge => edge.dashed)) legend.push('<span><i class="map-swatch dashed" aria-hidden="true"></i>Assumed, unresolved, proposed, or sequence only</span>');

  return `<section class="section panel responsibility-map" aria-labelledby="map-heading">
    <div class="map-title"><h2 id="map-heading">${title}</h2><span class="map-count">${edges.length} ${edges.length === 1 ? 'connection' : 'connections'}</span></div>
    <p class="muted">Select a node to open its record. See the list below for the reasoning and evidence behind each connection.</p>
    <div class="map-legend" aria-label="Map legend">${legend.join('')}</div>
    <div class="map-canvas"><div class="map-headings"><span>${labels[0]}</span><span>${labels[1]}</span></div>
    <div class="map-grid" style="--map-rows:${rows}">
      ${columns[0]}
      <svg class="map-connections" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="map-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke"/></marker></defs>
        ${paths.join('')}
      </svg>
      ${columns[1]}
    </div></div>
  </section>`;
}

function renderRelations(filterByActor = true) {
  const rows = visible('relations').filter(item => !filterByActor || actorMatches([item.from, item.to]));
  return `${filterByActor ? renderMap('Organization map', ['From actor', 'To actor'], ['actors', 'actors'], rows.map(item => ({
    ...item, dashed: item.status !== 'Teacher brief' || !hasCaseFactBasis(item.evidence)
  }))) : ''}<section class="section">${heading('Organizational relationships', 'Review approval, testing, reporting, and handoffs.', editButton('relations', '', '+ Add relationship'))}
    ${list(rows.map(item => recordRow('relations', item, endpoints('actors', item) + line(item.detail), [item.kind, item.phase, item.status], chips('evidence', item.evidence))), 'No matching relationships.')}</section>`;
}

function renderCausal() {
  const rows = visible('causes').filter(item => actorMatches([
    ...item.actors, ...find('events', item.from).actors, ...find('events', item.to).actors
  ]));
  const edges = rows.map(item => ({ ...item,
    status: item.kind === 'Sequence only' ? item.kind : item.status,
    dashed: item.kind === 'Sequence only' || !hasCaseFactBasis(item.evidence) ||
      [item.from, item.to].some(id => find('events', id).status !== 'Teacher brief')
  }));
  return `${renderMap('Directed causal map', ['Upstream event', 'Downstream event'], ['events', 'events'], edges)}
    <section class="section">${heading('Causal links', 'Review the mechanism and counterfactual behind each connection.', editButton('causes', '', '+ Add causal link'))}
    ${list(rows.map(item => recordRow('causes', item, endpoints('events', item) + line(item.reason) +
      (item.alternative ? `<p class="plain"><strong>Counterfactual or alternative</strong> · ${escape(item.alternative)}</p>` : ''), [item.kind, item.status],
      chips('actors', item.actors) + chips('evidence', item.evidence) + (item.evidence.length ? '' : empty('Add evidence for this causal link.')))), 'No matching causal links.')}</section>`;
}

function renderOrganization() {
  const rows = visible('actors').filter(item => item.kind !== 'Technical component' && actorMatches([item.id]));
  return `${renderRelations()}<section class="section">${heading('Knowledge and authority matrix', 'The entries show the group’s records for each person or organization.')}
    ${rows.length ? `<div class="table-wrap" tabindex="0" aria-label="Knowledge and authority table"><table>
    <thead><tr><th scope="col">Actor</th><th scope="col">What they knew</th><th scope="col">Formal authority</th><th scope="col">Practical control</th></tr></thead>
    <tbody>${rows.map(item => `<tr><th scope="row">${chips('actors', [item.id])}</th>
      ${[item.knowledge, item.authority, item.capacity].map(value => `<td class="plain">${escape(value || 'Open question')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty('No matching actors.')}</section>`;
}

function filterSelect(id, label, options, value) {
  return `<label class="input-label">${label}<select class="input-select" id="${id}">${['', ...options].map(option =>
    `<option value="${escape(option)}"${option === value ? ' selected' : ''}>${escape(displayStatus(option) || 'All')}</option>`).join('')}</select></label>`;
}

function renderActions() {
  const stages = schemas.actions.fields.find(field => field.key === 'phase').choices;
  const rows = visible('actions').filter(item => (!actionStage || item.phase === actionStage) && actorMatches([item.owner, ...item.actors]));
  return `<section class="section">${heading('Action plan', 'Proposals identify a person or organization, a trigger, and the evidence needed for review.', editButton('actions', '', '+ Add action'))}
    <div class="section-head">${filterSelect('action-stage', 'Filter by action stage', stages, actionStage)}</div>
    ${renderMap('Action ownership map', ['Proposed owner', 'Action'], ['actors', 'actions'], rows.map(item => ({
      ...item, from: item.owner, to: item.id, dashed: item.status !== 'Verified'
    })))}
    ${list(rows.map(item => recordRow('actions', item,
      `<p><strong>Proposed owner</strong> · ${escape(find('actors', item.owner)?.title || 'Unassigned')}</p>` +
      (item.resources ? `<p class="plain"><strong>Authority and resources</strong> · ${escape(item.resources)}</p>` : '') +
      (item.deadline ? `<p><strong>Trigger or deadline</strong> · ${escape(item.deadline)}</p>` : '') +
      (item.verification ? `<p class="plain"><strong>Completion evidence</strong> · ${escape(item.verification)}</p>` : empty('Add a completion check for this action.')),
      [item.phase, item.status], chips('actors', [item.owner, ...item.actors].filter(Boolean)) + chips('events', item.events) + chips('evidence', item.evidence))), 'No matching actions.')}</section>`;
}

function renderModels(model) {
  const rows = visible('claims').filter(item => item.model === model.label && actorMatches(item.actors));
  const filterActors = visible('actors');
  const content = { causal: renderCausal, organization: renderOrganization, future: renderActions }[model.id]();
  return `<nav class="view-tabs" aria-label="Responsibility models">${modelViews.map(item =>
    `<a class="button quiet" data-model="${item.id}" href="#models/${item.id}"${item.id === model.id ? ' aria-current="true"' : ''}>${icon(item.icon)}${item.label}</a>`).join('')}</nav>
    <div class="panel model-guide" data-model="${model.id}"><div class="section-head"><div><p class="eyebrow">MODEL GUIDE</p><h2>${model.question}</h2></div>
    <label class="input-label">Focus on actor<select class="input-select" id="actor-focus"><option value="">All actors</option>${filterActors.map(item =>
      `<option value="${item.id}"${item.id === actorFocus ? ' selected' : ''}>${escape(item.title)}</option>`).join('')}</select></label></div>
    <p class="muted">${model.prompt}</p></div>
    ${content}
    <section class="section">${heading('Group claims', 'Link a claim to the specific actor, event, and evidence you relied on.', editButton('claims', '', '+ Add model claim'))}
    ${list(rows.map(item => recordRow('claims', item, line(item.reason) + line(item.alternative), [item.status],
      chips('actors', item.actors) + chips('events', item.events) + chips('evidence', item.evidence) +
      (item.evidence.length ? '' : empty('Add evidence for this claim.')))), 'No matching group claims.')}</section>`;
}

function renderGaps() {
  return `<div class="note attention">Identify the responsibility or task at issue. Compare an unassigned duty, an assigned duty that was unfulfilled, and an incomplete record before reaching a judgment.</div>
    <section class="section">${heading('Gap inquiries', 'Record the strongest alternative explanation and the evidence that would change your judgment.', editButton('gaps', '', '+ Add gap inquiry'))}
    ${list(visible('gaps').map(item => recordRow('gaps', item,
      line(item.mechanism) + line(item.reason) + (item.alternative ? `<p class="plain"><strong>Alternative</strong> · ${escape(item.alternative)}</p>` : ''),
      [item.phase, item.type, item.status],
      chips('actors', item.actors) + chips('events', item.events) + chips('evidence', item.evidence) + chips('actions', item.actions))), 'No gap inquiries recorded.')}</section>
    <section class="section">${heading('Questions for the group')}<div class="cards">
    <article class="card"><h3>What was already assigned?</h3><p>Find a named owner, the task they accepted, and whether they had the information and means to do it.</p></article>
    <article class="card"><h3>Could anyone intervene?</h3><p>Check who had a timely alert and practical control over a pause or handoff.</p></article>
    <article class="card"><h3>What could settle the question?</h3><p>Link the exact test plan, incident record, or sign-off that could distinguish the competing explanations.</p></article>
    </div></section>`;
}

function renderResults() {
  const conclusions = project.conclusions;
  const remaining = modelViews.filter(model => !conclusions[model.id].trim()).map(model => model.label);
  const review = [
    remaining.length ? 'Conclusions still open: ' + remaining.join(', ') + '.' : '',
    conclusions.evidence.length ? '' : 'No case material is linked to the conclusions.',
    !conclusions.gap.trim() ? 'The gap judgment is open.' : ''
  ].filter(Boolean);
  return `<section>${heading('Three group conclusions', 'Write the reasons, strongest objections, and remaining uncertainty for each judgment.', editButton('conclusions', '', 'Edit conclusions'))}
    <div class="cards">${modelViews.map(model => `<article class="card conclusion-card" data-model="${model.id}"><p class="eyebrow">${model.label}</p><h3>${model.question}</h3>
    ${line(conclusions[model.id]) || '<p>Awaiting the group’s conclusion.</p>'}<a class="text-link" href="#models/${model.id}">Review model →</a></article>`).join('')}</div></section>
    <section class="section">${heading('Cross-model comparison and reflection')}<div class="row-list">
    ${schemas.conclusions.fields.slice(3, 7).map(field => `<article class="record-row"><div class="row-content"><h3>${field.label}</h3>${line(conclusions[field.key]) || '<p>Open for group discussion.</p>'}</div></article>`).join('')}
    </div></section>
    <section class="section">${heading('Evidence and completeness')}${chips('evidence', conclusions.evidence)}
    ${empty(review.join(' ') || 'All three model conclusions, the gap judgment, and references have entries. Review the reasoning as a group.')}</section>`;
}

function renderEvidence() {
  const statuses = schemas.evidence.fields.find(field => field.key === 'status').choices;
  const rows = visible('evidence').filter(item => !evidenceStatus || item.status === evidenceStatus);
  return `<div class="note">Case records support claims about what happened. Course readings help you choose and explain an analytical framework.</div>
    <section class="section">${heading('Case evidence', 'Record what a source can support and what remains uncertain.', editButton('evidence', '', '+ Add evidence'))}
    <div class="section-head">${filterSelect('evidence-status', 'Filter by source status', statuses, evidenceStatus)}</div>
    ${list(rows.map(item => recordRow('evidence', item, line([item.source, item.locator].filter(Boolean).join(' · ')) + line(item.detail) +
      (item.limits ? `<p class="plain"><strong>Limits</strong> · ${escape(item.limits)}</p>` : '') +
      (item.url ? `<p><a class="text-link" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a></p>` : ''), [item.status])), 'No matching evidence records.')}</section>
    <section class="section">${heading('Course readings', 'Expand a reading for a case-analysis prompt.')}
    <div class="readings">${readings.map(reading => `<details class="card"><summary>${escape(reading.title)}</summary><p>${escape(reading.author)} · ${escape(reading.topic)}</p><p>${escape(reading.note)}</p>
      ${reading.url ? `<p><a class="text-link" href="${reading.url}" target="_blank" rel="noopener noreferrer">Open publication ↗</a></p>` : ''}</details>`).join('')}</div></section>`;
}

function render({ scroll = false } = {}) {
  const { section, model } = route();
  const views = { case: renderCase, actors: renderActors, models: renderModels, gaps: renderGaps, results: renderResults, evidence: renderEvidence };
  document.querySelector('#navigation').innerHTML = sections.map(item =>
    `<a class="nav-link" href="#${item.id}"${item.id === section.id ? ' aria-current="page"' : ''}>${icon(item.icon)}<span>${item.label}</span><span class="nav-num">${item.number}</span></a>`).join('');
  document.querySelector('#breadcrumb').textContent = section.label;
  document.querySelector('.sidebar-bottom strong').textContent = project.caseInfo.title;
  const archivedCount = Object.keys(schemas).filter(group => Array.isArray(project[group])).flatMap(group => project[group]).filter(item => item.archived).length;
  const archiveControl = archivedCount ? `<section class="section"><button class="button secondary" type="button" data-command="archives" aria-pressed="${showArchived}">${showArchived ? 'Hide' : 'Show'} archived records (${archivedCount})</button></section>` : '';
  const header = section.id === 'case' ? '' : `<header class="view-header"><div><p class="eyebrow">WORKSPACE / ${section.number}</p>
    <h1>${section.label}</h1><p>${section.description}</p></div></header>`;
  main.innerHTML = header + views[section.id](model) + archiveControl;
  if (scroll) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
}

function formField(field, item) {
  const { key, label, type, choices, required, group, placeholder } = field;
  const value = item[key] ?? (type === 'links' ? [] : choices?.[0] ?? '');
  const options = group ? project[group].filter(record => !record.archived || (type === 'links' ? value.includes(record.id) : value === record.id)) : [];
  if (type === 'links') {
    return `<fieldset><legend>${label}</legend>${options.length ? options.map(record =>
      `<label class="check-label"><input type="checkbox" name="${key}" value="${record.id}"${value.includes(record.id) ? ' checked' : ''}>
        <span>${record.id} · ${escape(record.title)}${record.archived ? ' (archived)' : ''}</span></label>`).join('') : '<small>No available records.</small>'}</fieldset>`;
  }
  let control;
  if (type === 'select' || type === 'reference') {
    const entries = choices ? choices.map(choice => [choice, displayStatus(choice)]) : [
      ['', 'Select a record…'], ...options.map(record => [record.id, record.id + ' · ' + record.title + (record.archived ? ' (archived)' : '')])
    ];
    control = `<select name="${key}"${required ? ' required' : ''}>${entries.map(([id, title]) =>
      `<option value="${escape(id)}"${value === id ? ' selected' : ''}>${escape(title)}</option>`).join('')}</select>`;
  } else if (type === 'area') {
    control = `<textarea name="${key}" maxlength="12000" rows="3" placeholder="${escape(placeholder)}">${escape(value)}</textarea>`;
  } else {
    control = `<input name="${key}" type="${type}" value="${escape(value)}" maxlength="${type === 'url' ? 2048 : 240}"${required ? ' required' : ''}>`;
  }
  return `<label class="input-label">${label}${control}</label>`;
}

function openDialog(title, body, actions) {
  document.querySelector('#dialog-title').textContent = title;
  errorMessage.hidden = true;
  editorBody.innerHTML = body;
  editorActions.innerHTML = actions;
  if (!editor.open) editor.showModal();
  editorBody.scrollTop = 0;
}

function openEditor(group, id) {
  const collection = Array.isArray(project[group]);
  const item = collection ? find(group, id) : project[group];
  if (id && !item) return;
  editorState = { group, id };
  const { label, fields } = schemas[group];
  const draft = item ?? (group === 'claims' ? { model: route().model.label } : {});
  openDialog((item ? 'Edit ' : 'Add ') + label, fields.map(field => formField(field, draft)).join(''),
    (item && collection ? `<button class="button quiet archive" type="button" data-command="archive">${item.archived ? 'Restore record' : 'Archive record'}</button>` : '') +
    '<button class="button secondary" type="button" data-command="close">Cancel</button><button class="button primary" type="submit">Save changes</button>');
}

function completeEdit(message) {
  persist();
  editor.close();
  render();
  const { group, id } = editorState ?? {};
  const target = group && main.querySelector(`[data-edit="${group}"][data-id="${id}"]`);
  (target || main).focus({ preventScroll: true });
  announce(message);
}

function nextId(group) {
  const prefixes = { events: 'T', actors: 'P', causes: 'C', relations: 'R', claims: 'M', actions: 'A', gaps: 'G', evidence: 'E' };
  let number = 1;
  let id;
  do {
    id = prefixes[group] + String(number++).padStart(2, '0');
  } while (find(group, id));
  return id;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!editorState) return;
  const { group, id } = editorState;
  const values = new FormData(form);
  const fields = Object.fromEntries(schemas[group].fields.map(field => [
    field.key, field.type === 'links' ? values.getAll(field.key) : String(values.get(field.key) ?? '').trim()
  ]));
  const candidate = structuredClone(project);
  if (Array.isArray(candidate[group])) {
    if (id) {
      const index = candidate[group].findIndex(item => item.id === id);
      candidate[group][index] = { ...candidate[group][index], ...fields };
    } else {
      candidate[group].push({ id: nextId(group), archived: false, ...fields });
    }
  } else {
    candidate[group] = fields;
  }
  try {
    project = normalizeProject(candidate);
    completeEdit('Changes saved to the workspace.');
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  }
});

function download(filename, content, type) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  editor.close();
  announce('Download requested: ' + filename);
}

let pendingImport;
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  try {
    if (file.size > 30_000_000) throw new Error('Project exceeds 30 MB.');
    pendingImport = normalizeProject(JSON.parse(await file.text()));
    openDialog('Replace the current project?', `<p>Import <strong>${escape(pendingImport.caseInfo.title)}</strong>. Export your current JSON first if you need a backup.</p>`,
      '<button class="button secondary" type="button" data-command="close">Cancel</button><button class="button primary" type="button" data-command="replace">Replace project</button>');
  } catch (error) {
    announce('Import failed. ' + error.message);
  }
});

editor.addEventListener('close', () => {
  if (editor.open) return;
  editorState = undefined;
  pendingImport = undefined;
});

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.edit) {
    openEditor(button.dataset.edit, button.dataset.id);
    return;
  }
  switch (button.dataset.command) {
    case 'close':
      editor.close();
      break;
    case 'import':
      importFile.click();
      break;
    case 'example':
      pendingImport = createProject();
      openDialog('Load the group example?', '<p>This replaces the current workspace with the group’s simulated case and analysis. Export your current project as JSON first if you want to keep a copy.</p>',
        '<button class="button secondary" type="button" data-command="close">Cancel</button><button class="button primary" type="button" data-command="replace-example">Load example</button>');
      break;
    case 'export':
      openDialog('Export project', '<p>Use JSON to reopen the editable project or Markdown for the group’s written analysis.</p>',
        '<button class="button secondary" type="button" data-command="markdown">Download Markdown</button><button class="button primary" type="button" data-command="json">Download JSON</button>');
      break;
    case 'json':
      download('responsibility-project.json', JSON.stringify(project, null, 2), 'application/json');
      break;
    case 'markdown':
      download('responsibility-analysis.md', exportNotes(project), 'text/markdown;charset=utf-8');
      break;
    case 'replace':
    case 'replace-example':
      if (!pendingImport) break;
      project = pendingImport;
      showArchived = false;
      evidenceStatus = actionStage = actorFocus = '';
      completeEdit(button.dataset.command === 'replace-example' ? 'Group example loaded.' : 'Project imported.');
      break;
    case 'archive': {
      if (!editorState?.id) break;
      const item = find(editorState.group, editorState.id);
      item.archived = !item.archived;
      if (editorState.group === 'actors' && item.id === actorFocus && item.archived) actorFocus = '';
      completeEdit(item.archived ? 'Record archived. Existing references are retained.' : 'Record restored.');
      break;
    }
    case 'archives':
      showArchived = !showArchived;
      if (actorFocus && find('actors', actorFocus)?.archived && !showArchived) actorFocus = '';
      render();
      document.querySelector('[data-command="archives"]')?.focus();
      break;
  }
});

main.addEventListener('change', event => {
  const { id, value } = event.target;
  if (id === 'evidence-status') evidenceStatus = value;
  else if (id === 'action-stage') actionStage = value;
  else if (id === 'actor-focus') actorFocus = value;
  else return;
  render();
  document.getElementById(id)?.focus();
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => render({ scroll: true }));
render();
