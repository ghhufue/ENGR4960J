export const sections = [
  { id: 'case', label: 'Case & timeline', number: '01', icon: 'case', description: 'Establish the outcome, event sequence, and open questions.' },
  { id: 'actors', label: 'Actors & control', number: '02', icon: 'actors', description: 'Identify who knew, who decided, and who could intervene.' },
  { id: 'models', label: 'Three models', number: '03', icon: 'models', description: 'Examine one incident through three distinct lenses.' },
  { id: 'gaps', label: 'Responsibility gaps', number: '04', icon: 'gaps', description: 'Test whether a specific responsibility was left uncovered.' },
  { id: 'results', label: 'Comparison & conclusions', number: '05', icon: 'results', description: 'Compare and defend the group’s judgments.' },
  { id: 'evidence', label: 'Evidence & readings', number: '06', icon: 'evidence', description: 'Connect case records and ethical concepts to your argument.' }
];

const textField = (key, label, required = false) => ({ key, label, required, type: 'text' });
const area = (key, label, placeholder = '') => ({ key, label, placeholder, type: 'area' });
const select = (key, label, choices) => ({ key, label, choices, type: 'select' });
const reference = (key, label, group, required = false) => ({ key, label, group, required, type: 'reference' });
const links = (key, label, group) => ({ key, label, group, type: 'links' });
const titleField = textField('title', 'Title', true);
const evidenceField = links('evidence', 'Evidence references', 'evidence');
const eventField = links('events', 'Related events', 'events');
const actorField = links('actors', 'Related actors', 'actors');
const phases = ['Before surgery', 'During surgery', 'After the incident'];
const assessment = ['Unassessed', 'Supported', 'Contested', 'Not established'];
const factStates = ['Teacher brief', 'Group hypothesis', 'Open question'];
const modelNames = ['Causal', 'Hierarchy & organization', 'Forward-looking'];

export const schemas = {
  caseInfo: {
    label: 'case summary',
    fields: [titleField, area('description', 'Scenario'), area('harm', 'Harm and affected parties'), area('questions', 'Open questions')]
  },
  events: {
    label: 'event',
    fields: [titleField, select('phase', 'Stage', phases), textField('time', 'Time or ordering note'),
      select('status', 'Fact status', factStates), area('detail', 'Description and limits'), actorField, evidenceField]
  },
  actors: {
    label: 'actor',
    fields: [titleField, select('kind', 'Type', ['Person', 'Organization', 'Affected party', 'Technical component']),
      area('role', 'Role and stated duties'), area('knowledge', 'Information and visibility'),
      area('authority', 'Formal authority'), area('capacity', 'Practical ability to intervene'),
      area('position', 'Position, disagreement, or open question'), evidenceField]
  },
  causes: {
    label: 'causal link',
    fields: [titleField, reference('from', 'Upstream event', 'events', true), reference('to', 'Downstream event', 'events', true),
      select('kind', 'Link type', ['Causal contribution', 'Sequence only']),
      select('status', 'Assessment', assessment), area('reason', 'Mechanism and reasons'),
      area('alternative', 'Counterfactual or alternative explanation'), actorField, evidenceField]
  },
  relations: {
    label: 'organizational relationship',
    fields: [titleField, reference('from', 'From actor', 'actors', true), reference('to', 'To actor', 'actors', true),
      select('kind', 'Relationship', ['Approval', 'Reporting', 'Testing', 'Handoff', 'Communication', 'Other']),
      select('phase', 'Stage', phases), select('status', 'Fact status', factStates),
      area('detail', 'Expected duty, actual authority, or open question'), evidenceField]
  },
  claims: {
    label: 'model claim',
    fields: [titleField, select('model', 'Model', modelNames), select('status', 'Assessment', assessment),
      area('reason', 'Claim and reasoning'), area('alternative', 'Objection, contrary evidence, or uncertainty'),
      actorField, eventField, evidenceField]
  },
  actions: {
    label: 'action',
    fields: [titleField, select('phase', 'Action stage', ['Incident response', 'Before resuming', 'Long-term prevention']),
      select('status', 'Status', ['Proposed', 'Agreed', 'In progress', 'Verified']),
      reference('owner', 'Proposed owner', 'actors'), links('actors', 'Collaborators', 'actors'),
      area('resources', 'Authority and resources needed'), textField('deadline', 'Deadline or trigger'),
      area('verification', 'Completion evidence and review'), eventField, evidenceField]
  },
  gaps: {
    label: 'gap inquiry',
    fields: [titleField, select('phase', 'Stage', phases),
      select('type', 'Responsibility in question', ['Active responsibility', 'Moral culpability', 'Moral accountability', 'Public accountability', 'Legal remedy or compensation', 'Undetermined']),
      select('status', 'Judgment', ['Unassessed', 'Gap supported', 'Gap not established', 'Insufficient information']),
      area('mechanism', 'Possible mechanism'), area('reason', 'Current division of duty and your reasoning'),
      area('alternative', 'Alternative explanation and what would change your judgment'),
      actorField, eventField, evidenceField, links('actions', 'Linked responses', 'actions')]
  },
  evidence: {
    label: 'evidence record',
    fields: [titleField, select('status', 'Source status', ['Teacher brief', 'To obtain', 'Simulated material', 'Group source']),
      textField('source', 'Source or citation'), textField('locator', 'Page, timestamp, or record location'),
      { key: 'url', label: 'Source URL', type: 'url' }, area('detail', 'What this could support'),
      area('limits', 'Limitations or uncertainty')]
  },
  conclusions: {
    label: 'conclusions',
    fields: [area('causal', 'Causal conclusion'), area('organization', 'Hierarchy and organization conclusion'),
      area('future', 'Forward-looking conclusion'), area('comparison', 'Where the models differ'),
      area('gap', 'Responsibility gap conclusion'), area('legal', 'Optional legal responsibility or compensation'),
      area('reflection', 'Reflection and one improvement'), evidenceField]
  }
};

const record = (id, fields) => ({ id, archived: false, ...fields });

export function createProject() {
  return normalizeProject({
    version: 1,
    caseInfo: {
      title: 'Telerobotic surgery',
      description: 'During a remote operation, network delay disrupts the connection. The surgical robot’s AI-assisted motion system processes a delayed command, causing an unintended instrument movement that injures the patient.',
      harm: 'The patient is injured by an unintended instrument movement. The brief does not specify the nature or severity of the injury.',
      questions: 'Where did the delay occur? What did the surgeon see, and could they pause in time? Who was responsible for testing the combined system under abnormal latency?'
    },
    events: [
      record('T01', { title: 'Surgeon issues a command', phase: phases[1], status: factStates[0], detail: 'The surgeon operates the robot remotely. The brief gives no command timestamp.', actors: ['P01'], evidence: ['E01'] }),
      record('T02', { title: 'Network delay disrupts the link', phase: phases[1], status: factStates[0], detail: 'The location and duration of the delay remain open.', actors: ['P05', 'P06'], evidence: ['E01'] }),
      record('T03', { title: 'Motion system processes delayed input', phase: phases[1], status: factStates[0], detail: 'The system combines the surgeon’s commands with a machine-learning model designed to stabilize instrument movements.', actors: ['P04', 'P07'], evidence: ['E01'] }),
      record('T04', { title: 'Instrument moves unexpectedly', phase: phases[1], status: factStates[0], detail: 'The delayed command is interpreted in a way that produces unintended motion.', actors: ['P08'], evidence: ['E01'] }),
      record('T05', { title: 'Patient is injured', phase: phases[1], status: factStates[0], detail: 'The brief identifies the patient as the injured party.', actors: ['P02'], evidence: ['E01'] }),
      record('T06', { title: 'Organizations attribute the incident elsewhere', phase: phases[2], status: factStates[0], detail: 'The hospital, manufacturer, and network provider point to other parts of the system. Their specific accounts remain open.', actors: ['P03', 'P04', 'P05'], evidence: ['E01'] }),
      record('T07', { title: 'Possible freeze on the surgeon’s console', phase: phases[1], status: factStates[1], detail: 'Optional case extension for the group to review. If the video froze, could the surgeon distinguish a stale image from a live one in time to intervene?', actors: ['P01'], evidence: ['E02'] })
    ],
    actors: [
      record('P01', { title: 'Remote surgeon', kind: 'Person', role: 'Operates the surgical robot from a remote console.', position: 'What could the surgeon see, and was timely intervention possible?', evidence: ['E01'] }),
      record('P02', { title: 'Patient', kind: 'Affected party', role: 'Injured by the unintended instrument movement.', position: 'Record the patient’s questions and support needs as part of the group’s case analysis.', evidence: ['E01'] }),
      record('P03', { title: 'Hospital', kind: 'Organization', role: 'Organization involved in the operation.', position: 'Who approved use, could pause operations, and should explain the outcome to the patient?', evidence: ['E01'] }),
      record('P04', { title: 'Robot manufacturer', kind: 'Organization', role: 'Manufactures the surgical robot.', position: 'What control logic and system test information were available to the manufacturer?', evidence: ['E01'] }),
      record('P05', { title: 'Network provider', kind: 'Organization', role: 'Provides the communication link.', position: 'What could the provider monitor, communicate, or change, and under what agreement?', evidence: ['E01'] }),
      record('P06', { title: 'Network link', kind: 'Technical component', role: 'Carries commands between the console and the robot.', evidence: ['E01'] }),
      record('P07', { title: 'AI-assisted motion system', kind: 'Technical component', role: 'Uses a machine-learning model to stabilize instrument movement while processing commands.', evidence: ['E01'] }),
      record('P08', { title: 'Surgical robot', kind: 'Technical component', role: 'Executes instrument movement at the patient site.', evidence: ['E01'] })
    ],
    causes: [
      record('C01', { title: 'Command encounters network delay', from: 'T01', to: 'T02', kind: 'Sequence only', reason: 'The command is transmitted and encounters delay. Determine where the delay arose.', evidence: ['E01'] }),
      record('C02', { title: 'Delayed command reaches motion system', from: 'T02', to: 'T03', reason: 'Reconstruct the same command across the console, link, and robot.', evidence: ['E01'] }),
      record('C03', { title: 'Processing leads to unintended motion', from: 'T03', to: 'T04', reason: 'The brief links interpretation of a delayed command to unintended movement. The underlying mechanism is open.', alternative: 'If the control system could identify and reject an expired command, which part of the chain might change?', actors: ['P04', 'P07', 'P08'], evidence: ['E01'] }),
      record('C04', { title: 'Unintended motion injures patient', from: 'T04', to: 'T05', reason: 'This outcome is specified in the teacher brief.', evidence: ['E01'] })
    ],
    relations: [
      record('R01', { title: 'Who signs off on integrated testing?', from: 'P03', to: 'P04', kind: 'Testing', phase: phases[0], status: factStates[2], detail: 'Check whether any party accepted responsibility for testing the combined system under delay.', evidence: ['E03'] }),
      record('R02', { title: 'Who receives a network anomaly alert?', from: 'P05', to: 'P03', kind: 'Reporting', phase: phases[1], status: factStates[2], detail: 'Check who can see a link anomaly and who can relay it in time to act.', evidence: ['E03'] })
    ],
    evidence: [
      record('E01', { title: 'Telerobotic surgery case brief', status: 'Teacher brief', source: 'ENGR4960J Assignment 2 · case.txt', locator: 'Telerobotic surgery', detail: 'Establishes the event sequence, patient harm, use of a stabilizing model, and disagreement among the three organizations.', limits: 'No timestamps, control design, test records, or specific statements are given.' }),
      record('E02', { title: 'Console, network, and robot logs', status: 'To obtain', detail: 'Trace one command using identifiers, timestamps, alerts, execution records, and system versions.', limits: 'Independent clocks and missing command IDs may prevent precise ordering.' }),
      record('E03', { title: 'Sign-off, test, and escalation records', status: 'To obtain', detail: 'Check who was assigned integrated testing, who received alerts, and who could authorize a pause.', limits: 'A written duty and practical control during the event need separate checks.' }),
      record('E04', { title: 'Party accounts and patient communication', status: 'To obtain', detail: 'Compare each organization’s account and record what the patient wants explained.', limits: 'An account is evidence of what was said. Check its factual claims separately.' })
    ],
    gaps: [
      record('G01', { title: 'Who validates the system under abnormal delay?', phase: phases[0], type: 'Active responsibility', status: 'Insufficient information', mechanism: 'The component tests and the integrated test may have different owners. The brief does not give the division of duties.', alternative: 'Compare an unassigned duty, an assigned duty that went unfulfilled, and a missing record. A signed test plan could change the judgment.', actors: ['P03', 'P04', 'P05'], events: ['T02', 'T03'], evidence: ['E03'], actions: ['A03'] })
    ],
    actions: [
      record('A01', { title: 'Coordinate investigation and preserve records', phase: 'Incident response', owner: 'P03', actors: ['P04', 'P05'], deadline: 'At the start of the joint investigation', verification: 'Record the versions, sources, and clock alignment of the preserved logs.', events: ['T02', 'T03'], evidence: ['E02'] }),
      record('A02', { title: 'Explain the incident and coordinate patient support', phase: 'Incident response', owner: 'P03', actors: ['P02'], verification: 'Document the patient’s questions, the information shared, and the next contact date.', events: ['T05'], evidence: ['E04'] }),
      record('A03', { title: 'Review integrated behavior under abnormal latency', phase: 'Before resuming', owner: 'P03', actors: ['P04', 'P05'], deadline: 'Before a decision to resume remote use', verification: 'Document simulated delay and disconnection tests, alert and pause behavior, named owners, and review sign-off.', events: ['T02', 'T03', 'T04'], evidence: ['E03'] })
    ],
    claims: [],
    conclusions: {}
  });
}

export const readings = [
  { title: 'Ethics, Technology, and Engineering', author: 'van de Poel & Royakkers · 2011 · pp. 9–13, 252–267', topic: 'Causal & organizational', note: 'Separate causal contribution from blame. Ask what each actor could reasonably foresee and do, and where information and authority came apart.' },
  { title: 'Engineering Ethics: Contemporary and Enduring Debates', author: 'Deborah G. Johnson · 2020 · ch. 6, especially pp. 122–123', topic: 'Organizational', note: 'Compare the duty to explain, moral blame, and compensation. One incident can point to different actors for each.' },
  { title: 'Introduction to the Ethics of Emerging Technologies', author: 'Reijers, Young & Coeckelbergh · 2025 · pp. 84–86', topic: 'Forward-looking', note: 'Record who can respond to future risk and how the affected patient can be heard.', url: 'https://doi.org/10.1007/978-3-031-85887-1_6' },
  { title: 'The responsibility gap', author: 'Andreas Matthias · 2004 · pp. 175–183', topic: 'Responsibility gaps', note: 'Test whether unpredictability and limited control actually undermine the grounds for assigning a particular responsibility.', url: 'https://doi.org/10.1007/s10676-004-3422-1' },
  { title: 'Four Responsibility Gaps with Artificial Intelligence', author: 'Santoni de Sio & Mecacci · 2021', topic: 'Responsibility gaps', note: 'Distinguish culpability, moral accountability, public accountability, and active responsibility.', url: 'https://doi.org/10.1007/s13347-021-00450-x' },
  { title: 'There Is No Techno-Responsibility Gap', author: 'Daniel W. Tigard · 2021', topic: 'Counterargument', note: 'Check whether existing responsibilities already provide a defensible account.', url: 'https://doi.org/10.1007/s13347-020-00414-7' },
  { title: 'Meaningful Human Control over Autonomous Systems', author: 'Santoni de Sio & van den Hoven · 2018', topic: 'Human control', note: 'Ask what the system responds to and whether an outcome can be traced to a person who understands their role.', url: 'https://doi.org/10.3389/frobt.2018.00015' },
  { title: 'Moral Crumple Zones', author: 'Madeleine Clare Elish · 2019', topic: 'Human control', note: 'Ask whether the closest operator had the information, time, and authority needed to intervene.', url: 'https://doi.org/10.17351/ests2019.260' },
  { title: 'Responsibility and Global Justice', author: 'Iris Marion Young · 2006', topic: 'Forward-looking', note: 'If a harm comes from shared organizational arrangements, ask which participants can work together to change them.', url: 'https://doi.org/10.1017/S0265052506060043' },
  { title: 'Global Engineering Ethics', author: 'Luegenbiehl & Clancy · 2017 · pp. 83–87', topic: 'Further reading', note: 'The teacher’s prototype recommends these pages for further reading on safety responsibilities.', url: 'https://www.sciencedirect.com/book/monograph/9780128112182/global-engineering-ethics' }
];

const groups = Object.keys(schemas).filter(key => key !== 'caseInfo' && key !== 'conclusions');
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && /^[A-Z][A-Z0-9-]{1,47}$/.test(value);

function normalizeFields(group, input) {
  if (!isRecord(input)) throw new Error('Invalid ' + schemas[group].label + '.');
  const output = {};
  for (const field of schemas[group].fields) {
    const { key, type, choices, required, label } = field;
    const value = input[key] ?? (type === 'links' ? [] : choices?.[0] ?? '');
    if (type === 'links') {
      if (!Array.isArray(value) || value.length > 250 || !value.every(validId)) throw new Error('Invalid links in ' + label + '.');
      output[key] = [...new Set(value)];
      continue;
    }
    if (typeof value !== 'string' || value.length > 12000 || (required && !value.trim()) ||
        (choices && !choices.includes(value)) || (type === 'reference' && value && !validId(value))) {
      throw new Error('Invalid ' + label + '.');
    }
    if (type === 'url' && value) {
      let parsed;
      try { parsed = new URL(value); } catch { throw new Error('Enter a valid source URL.'); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Source links must use HTTP or HTTPS.');
    }
    output[key] = value;
  }
  return output;
}

export function normalizeProject(input) {
  if (!isRecord(input) || input.version !== 1) throw new Error('This project format is not supported.');
  const project = { version: 1, caseInfo: normalizeFields('caseInfo', input.caseInfo), conclusions: normalizeFields('conclusions', input.conclusions) };
  const indexes = {};
  for (const group of groups) {
    const collection = input[group];
    if (!Array.isArray(collection) || collection.length > 250) throw new Error('Invalid ' + group + ' collection.');
    const ids = indexes[group] = new Set();
    project[group] = collection.map(item => {
      if (!isRecord(item) || !validId(item.id) || ids.has(item.id) || typeof item.archived !== 'boolean') {
        throw new Error('Invalid or repeated record ID in ' + group + '.');
      }
      ids.add(item.id);
      return record(item.id, { ...normalizeFields(group, item), archived: item.archived });
    });
  }
  for (const group of [...groups, 'conclusions']) {
    const records = group === 'conclusions' ? [project.conclusions] : project[group];
    for (const item of records) {
      for (const field of schemas[group].fields.filter(field => field.group)) {
        const targets = field.type === 'links' ? item[field.key] : [item[field.key]].filter(Boolean);
        if (targets.some(id => !indexes[field.group].has(id))) throw new Error('Missing referenced record in ' + field.label + '.');
      }
      if ((group === 'causes' || group === 'relations') && item.from === item.to) {
        throw new Error('Choose different endpoints for the relationship.');
      }
    }
  }
  return project;
}

export function exportNotes(project) {
  const printable = value => value.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
  const lines = ['# ' + printable(project.caseInfo.title.replace(/\s+/g, ' ')), '', 'ENGR4960J · Assignment 2 · Group analysis', ''];
  const appendFields = (group, item, omitTitle = false) => {
    for (const field of schemas[group].fields) {
      if (omitTitle && field.key === 'title') continue;
      const value = item[field.key];
      if (!value.length) continue;
      const display = Array.isArray(value) ? value.join(', ') : value;
      lines.push('**' + field.label + '**', '', printable(display), '');
    }
  };
  appendFields('caseInfo', project.caseInfo, true);
  const titles = { events: 'Timeline', actors: 'Actors and control', causes: 'Causal links', relations: 'Organizational relationships',
    claims: 'Model claims', actions: 'Forward-looking actions', gaps: 'Responsibility gaps', evidence: 'Evidence' };
  for (const group of ['events', 'actors', 'causes', 'relations', 'claims', 'actions', 'gaps', 'evidence']) {
    lines.push('## ' + titles[group], '');
    if (!project[group].length) lines.push('No records entered.', '');
    for (const item of project[group]) {
      lines.push('### ' + item.id + ' · ' + printable(item.title.replace(/\s+/g, ' ')) + (item.archived ? ' (Archived)' : ''), '');
      appendFields(group, item, true);
    }
  }
  lines.push('## Group conclusions', '');
  appendFields('conclusions', project.conclusions);
  return lines.join('\n');
}
