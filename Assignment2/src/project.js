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
const simulated = 'Simulated material';
const factStates = ['Teacher brief', 'Group hypothesis', 'Open question', simulated];
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
      select('kind', 'Relationship', ['Approval', 'Reporting', 'Testing', 'Handoff', 'Communication', 'Other', 'Contracting', 'Release authority', 'Credentialing']),
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
      select('status', 'Judgment', ['Unassessed', 'Gap supported', 'Gap not established', 'Insufficient information', 'Apparent gap', 'Gap supported · repairable']),
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
      description: 'In the group’s simulated reconstruction, a surgeon in Seattle operates a robot at Ridgeline Community Hospital. The SteadyPath stabilization model extrapolates a burst of delayed commands. The instrument overshoots by 7 mm and lacerates a renal artery branch. Afterwards, the organizations point to different parts of the system.',
      harm: 'Assumed (A10 / E14): 2.1 L of blood loss, six units transfused, conversion to open surgery and radical nephrectomy. Chronic kidney disease progresses from stage 2 to 3b. The patient spends nine days in hospital, including two in intensive care, and faces lifelong follow-up and psychological distress.',
      questions: 'Would synchronized logs confirm SteadyPath’s input and output as reconstructed? The simulated clocks differ by up to 300 ms. What did the manual say, who saw it, and who could suspend the operation?'
    },
    events: [
      record('T01', { title: 'Surgeon issues a command', phase: phases[1], status: factStates[0], detail: 'The surgeon operates the robot remotely. The brief gives no command timestamp.', actors: ['P01'], evidence: ['E01'] }),
      record('T02', { title: 'Network delay disrupts the link', phase: phases[1], status: factStates[0], detail: 'The location and duration of the delay remain open.', actors: ['P05', 'P06'], evidence: ['E01'] }),
      record('T03', { title: 'Motion system processes delayed input', phase: phases[1], status: factStates[0], detail: 'The system combines the surgeon’s commands with a machine-learning model designed to stabilize instrument movements.', actors: ['P04', 'P07'], evidence: ['E01'] }),
      record('T04', { title: 'Instrument moves unexpectedly', phase: phases[1], status: factStates[0], detail: 'The delayed command is interpreted in a way that produces unintended motion.', actors: ['P08'], evidence: ['E01'] }),
      record('T05', { title: 'Patient is injured', phase: phases[1], status: factStates[0], detail: 'The brief identifies the patient as the injured party.', actors: ['P02'], evidence: ['E01'] }),
      record('T06', { title: 'Organizations attribute the incident elsewhere', phase: phases[2], status: factStates[0], detail: 'The hospital, manufacturer, and network provider point to other parts of the system. Their specific accounts remain open.', actors: ['P03', 'P04', 'P05'], evidence: ['E01'] }),
      record('T07', { title: 'Delayed video and a hard-to-interpret warning', phase: phases[1], status: simulated, detail: 'The surgeon sees delayed video and a latency warning. The quick guide omits the validation limit.', actors: ['P01'], evidence: ['E09', 'E10'] }),
      ...[
        ['T08', phases[1], '14:31:02.00', '5G slice degrades', 'Degradation follows cell-site reconfiguration.', ['P05', 'P06'], ['E06']],
        ['T09', phases[1], '14:31:02.35', 'Silent internet failover', 'The router switches to the public internet tunnel without notifying either surgical team.', ['P05'], ['E06', 'E11']],
        ['T10', phases[1], '14:31:02.90', 'Latency indicator turns red', 'Latency reaches the red threshold of 400 ms. No automatic action follows.', ['P01', 'P04'], ['E09']],
        ['T11', phases[1], '14:31:03.62', 'Burst of 11 packets arrives', 'About 410 ms of motion arrives in 180 ms.', ['P06'], ['E06']],
        ['T12', phases[1], '14:31:03.62–03.78', 'SteadyPath extrapolates the burst', 'Instrument velocity reaches 3.1 times the input velocity and the tip overshoots by 7 mm.', ['P07', 'P08'], ['E08', 'E13']],
        ['T13', phases[1], '14:31:03.80', 'Segmental artery branch is lacerated', 'The instrument strikes the vessel during hilar dissection.', ['P02', 'P08'], ['E07', 'E14']],
        ['T14', phases[1], '14:31:04.10', 'Surgeon releases clutch and bedside PA applies pressure', 'The report separately gives a shorter reaction estimate. These timestamps imply about 1.2 seconds from the red warning.', ['P01', 'P09'], ['E09']],
        ['T15', phases[2], '14:31:50', 'Bedside surgeon reaches the table', 'Open conversion follows by 14:40.', ['P09'], ['E09', 'E14']],
        ['T16', phases[0], '19 days before surgery', 'SteadyPath v3.2 installed', 'The update increases the prediction horizon from 40 to 90 ms.', ['P04', 'P07'], ['E10']],
        ['T17', phases[0], '', 'Hospital approves telesurgery and signs network contract', 'Ridgeline Community Hospital (RCH) approves the procedure without an integrated test. The CFO signs the NorthLink contract.', ['P03', 'P05'], ['E11']],
        ['T18', phases[0], '', 'Remote surgeon credentialed', 'Training includes 20 simulator hours and omits degraded-network scenarios.', ['P01', 'P03'], ['E11']],
        ['T19', phases[0], '', 'Patient signs generic consent', 'A single additional sentence discloses remote participation.', ['P02', 'P03'], ['E12']]
      ].map(([id, phase, time, title, detail, actors, evidence]) => record(id, { phase, time, title, detail, actors, evidence, status: simulated }))
    ],
    actors: [
      record('P01', { title: 'Remote surgeon (Dr. M.)', kind: 'Person', role: 'Operates the robot from Seattle.', knowledge: 'Saw the latency warning. Training and the quick guide omitted the 200 ms limit and model extrapolation.', authority: 'Clinical command and clutch release.', capacity: 'Could release the clutch. The simulated motion lasted 160 ms, leaving little time for human correction.', position: 'The exact reaction time is unresolved.', evidence: ['E05', 'E09', 'E10', 'E13'] }),
      record('P02', { title: 'Patient', kind: 'Affected party', role: 'Injured by the instrument overshoot.', knowledge: 'Received a generic disclosure of remote participation.', authority: 'Can seek an explanation, continuing care, and a remedy.', capacity: 'Had no operational control during surgery.', evidence: ['E12', 'E14'] }),
      record('P03', { title: 'Ridgeline Community Hospital (RCH)', kind: 'Organization', role: 'Approves, staffs, and procures the service.', knowledge: 'Had access to Axion’s documentation and the best-effort network contract.', authority: 'Approves telesurgery, signs contracts, credentials staff and sets bedside staffing.', capacity: 'Could require an integrated test, a dedicated link, a scrubbed backup surgeon, and specific consent.', evidence: ['E05', 'E10', 'E11', 'E12'] }),
      record('P04', { title: 'Axion (manufacturer)', kind: 'Organization', role: 'Develops the TS-4 robot and SteadyPath.', knowledge: 'Knew the model’s training envelope, the documented 200 ms system limit, and the v3.2 horizon change.', authority: 'Controls the release process, PCCP, labeling, and alarm logic.', capacity: 'Can detect stale commands, gate prediction, implement safe-stop and surface limits in the guide.', evidence: ['E05', 'E08', 'E09', 'E10'] }),
      record('P05', { title: 'NorthLink (network provider)', kind: 'Organization', role: 'Provides and configures the managed network service.', knowledge: 'Knew the best-effort terms and failover behavior. Knowledge of the live surgery use is uncertain.', authority: 'Controls failover configuration.', capacity: 'Can notify both sites and offer a surgical-grade link.', evidence: ['E05', 'E06', 'E11'] }),
      record('P06', { title: 'Network link', kind: 'Technical component', role: 'Carries commands between the console and robot.', capacity: 'In the simulation, delay, jitter, and loss bunch queued commands.', evidence: ['E06'] }),
      record('P07', { title: 'SteadyPath stabilization model', kind: 'Technical component', role: 'Interprets the surgeon’s commands and stabilizes instrument motion.', capacity: 'Extrapolates a burst as fast intent. The model is locked between releases.', evidence: ['E08', 'E10', 'E19'] }),
      record('P08', { title: 'Axion TS-4 surgical robot', kind: 'Technical component', role: 'Executes instrument movement at the patient site.', capacity: 'Executes the overshoot without a latency-linked rate limit.', evidence: ['E05', 'E08', 'E09'] }),
      record('P09', { title: 'Bedside team', kind: 'Person', role: 'Physician assistant, on-site surgeon, anesthesia staff, and nurses.', authority: 'The on-site surgeon can take over and convert to open surgery.', capacity: 'The PA can apply pressure. The unscrubbed surgeon needs about 45 seconds to reach the table.', position: 'Could a credentialed, scrubbed backup have intervened sooner?', evidence: ['E09', 'E11', 'E15'] }),
      record('P10', { title: 'FDA (regulator)', kind: 'Organization', role: 'Has a postmarket oversight role in the group’s analysis.', position: 'Did the change-control plan cover degraded-network behavior?', evidence: ['E10'] })
    ],
    causes: [
      record('C01', { title: 'Degradation triggers silent failover', from: 'T08', to: 'T09', status: 'Supported', reason: 'Cell-site reconfiguration degrades the slice. The router silently fails over to a best-effort path with high delay and jitter.', alternative: 'A dedicated line could avoid this path. A timely alert could give the team an opportunity to pause.', actors: ['P05', 'P06'], evidence: ['E06', 'E11'] }),
      record('C02', { title: 'Backup path delivers a burst', from: 'T09', to: 'T11', status: 'Supported', reason: 'Eleven queued packets arrive in 180 ms, compressing about 410 ms of motion.', actors: ['P05', 'P06'], evidence: ['E06'] }),
      record('C03', { title: 'SteadyPath reads the burst as fast intent', from: 'T11', to: 'T12', status: 'Supported', reason: 'Version 3.2 extrapolates over a 90 ms horizon without checking whether the commands are stale.', alternative: 'Stale-command detection or disabling prediction above the 200 ms documented limit could break this link.', actors: ['P04', 'P07'], evidence: ['E08', 'E10', 'E13'] }),
      record('C04', { title: 'Overshoot injures the patient', from: 'T12', to: 'T13', status: 'Supported', reason: 'Velocity reaches 3.1 times the input velocity and the tool overshoots by 7 mm beside the segmental artery.', actors: ['P02', 'P08'], evidence: ['E07', 'E08', 'E14'] }),
      record('C05', { title: 'Missing degradation-triggered safe-stop permits motion', from: 'T10', to: 'T12', status: 'Supported', reason: 'The hold-on-loss rule requires 500 ms with no packets. It allows motion during high latency and bursty delivery.', actors: ['P04', 'P08'], evidence: ['E09'] }),
      record('C06', { title: 'Warning gives no actionable instruction', from: 'T07', to: 'T12', status: 'Contested', reason: 'The console turns red at 400 ms and the guide omits the 200 ms limit. Whether a clearer warning alone would have enabled a timely pause is uncertain.', actors: ['P01', 'P04'], evidence: ['E09', 'E10'] }),
      record('C07', { title: 'Time to bedside takeover may worsen bleeding', from: 'T14', to: 'T15', status: 'Contested', reason: 'The PA applies pressure while the unscrubbed surgeon is summoned. Earlier takeover might reduce blood loss.', actors: ['P03', 'P09'], evidence: ['E09', 'E11', 'E14'] })
    ],
    relations: [
      record('R01', { title: 'Integrated testing had no named owner', from: 'P03', to: 'P04', kind: 'Testing', phase: phases[0], status: simulated, detail: 'The reconstruction assumes RCH approved the procedure on Axion’s documentation without testing the combined system. The indicated handoff was unresolved.', evidence: ['E11'] }),
      record('R02', { title: 'Neither site received a failover alert', from: 'P05', to: 'P03', kind: 'Reporting', phase: phases[1], status: simulated, detail: 'The reconstruction assumes neither surgical team was notified. The connection indicates the expected reporting path.', evidence: ['E06', 'E11'] }),
      record('R03', { title: 'CFO signs the network contract', from: 'P03', to: 'P05', kind: 'Contracting', phase: phases[0], status: simulated, detail: 'Clinical engineering and the telesurgery committee did not review the contract.', evidence: ['E11'] }),
      record('R04', { title: 'Axion release board approves v3.2', from: 'P04', to: 'P07', kind: 'Release authority', phase: phases[0], status: simulated, detail: 'Axion releases the change under its predetermined change control plan (PCCP).', evidence: ['E10'] }),
      record('R05', { title: 'Hospital credentials Dr. M.', from: 'P03', to: 'P01', kind: 'Credentialing', phase: phases[0], status: simulated, detail: 'The telesurgery committee requires 20 simulator hours without a degraded-network exercise.', evidence: ['E11'] }),
      record('R06', { title: 'Surgeon escalates to the bedside team', from: 'P01', to: 'P09', kind: 'Handoff', phase: phases[1], status: simulated, detail: 'The bedside surgeon reaches the table roughly 45 seconds later.', evidence: ['E09'] })
    ],
    evidence: [
      record('E01', { title: 'Telerobotic surgery case brief', status: 'Teacher brief', source: 'ENGR4960J Assignment 2 · case.txt', locator: 'Telerobotic surgery', detail: 'Establishes the broad event sequence, patient harm, use of a stabilizing model, and disagreement among the three organizations.', limits: 'The timestamps, controls and test details in E05–E14 come from the group’s simulated reconstruction.' }),
      record('E02', { title: 'Console, network, and robot logs', status: 'To obtain', detail: 'Trace one command using identifiers, timestamps, alerts, execution records, and system versions.', limits: 'Independent clocks and missing command IDs may prevent precise ordering. Represented in the report by simulated assumption A9.' }),
      record('E03', { title: 'Sign-off, test, and escalation records', status: 'To obtain', detail: 'Check who was assigned integrated testing, who received alerts, and who could authorize a pause.', limits: 'Written duties and practical control need separate checks. Represented in the report by simulated assumption A7.' }),
      record('E04', { title: 'Party accounts and patient communication', status: 'To obtain', detail: 'Compare each organization’s account and record what the patient wants explained.', limits: 'Check the factual claims of each account separately. A1–A10 provide simulated context.' }),
      ...[
        ['E05', 'A1', 'Setting, parties, and distance', 'Dr. M. in Seattle operates the Axion TS-4 at rural Ridgeline Community Hospital in Washington, about 280 km away. NorthLink supplies the network.', 'Invented for the exercise.'],
        ['E06', 'A2', 'Network design and failure', 'The 5G slice targets 50 ms and normally yields about 150 ms total latency. Failover leads to a 2.4 s period at 480–620 ms, with 140 ms jitter and 3.8% loss. At 14:31:03.62, 11 packets carrying about 410 ms of motion arrive over 180 ms.', 'The timing and packet behavior would need corroboration from logs.'],
        ['E07', 'A3', 'Procedure and risk', 'A 58-year-old patient with stage 2 chronic kidney disease undergoes partial nephrectomy, with hilar dissection next to a segmental artery. The group applies the high-risk tier discussed in E15.', 'The procedure and patient details are simulated.'],
        ['E08', 'A4', 'SteadyPath training and extrapolation', 'The model is trained on about 41,000 hours below 120 ms, with no validation above 250 ms and no stale-command check. It produces 3.1 times the input velocity for 160 ms, overshooting by 7 mm.', 'The mechanism and training envelope are modeling assumptions. E10 records the separately assumed documented system limit of 200 ms.'],
        ['E09', 'A5', 'Warnings, safe-stop, and bedside response', 'Amber and red warnings appear at 250 and 400 ms without automatic intervention. Hold-on-loss requires 500 ms with zero packets. A physician assistant is at the table and the unscrubbed surgeon arrives about 45 seconds later.', 'The timeline implies about 1.2 seconds between the red warning and clutch release. A separate 0.5-second estimate in the group notes needs reconciliation.'],
        ['E10', 'A6', 'Documentation and v3.2 update', 'The manual states a 200 ms validation limit, omitted from the quick guide and training. Version 3.2, released 19 days before the incident under a PCCP, extends prediction from 40 to 90 ms. The test set omits degraded-network data.', 'The manual, training and test records are assumed.'],
        ['E11', 'A7', 'Hospital approvals, contracting, and training', 'RCH skips integrated testing. Its CFO signs a 99.9% best-effort agreement with internet failover. Clinical engineering and the committee do not review it. Three contracts leave system-level safety unassigned. Credentialing includes 20 simulator hours without degraded-network scenarios.', 'Contract and approval details are assumed.'],
        ['E12', 'A8', 'Informed consent', 'One sentence discloses remote participation. The form omits model assistance, network risk, takeover, and alternatives.', 'The consent form is simulated.'],
        ['E13', 'A9', 'Logging and custody', 'Axion holds 1 kHz kinematics and the keys to a 10-minute buffer preserved only if flagged within 24 hours. NorthLink holds five-minute aggregates. RCH holds OR video and the room timeline. Clocks differ by up to 300 ms. Surgeon input is smooth, while output reaches 3.1 times input velocity.', 'The logs are hypothetical and alignment would need checking.'],
        ['E14', 'A10', 'Injury and long-term effects', 'The patient loses 2.1 L of blood, receives six units, and undergoes open conversion and radical nephrectomy. CKD progresses from stage 2 to 3b. Hospitalization lasts nine days, including two in intensive care, with lifelong follow-up and psychological distress.', 'The injury severity and outcomes are simulated.']
      ].map(([id, locator, title, detail, limits]) => record(id, { title, status: simulated, source: 'ENGR4960_P2_Case · group report', locator, detail, limits })),
      ...[
        ['E15', 'Fong et al. (2026)', 'CRSA consensus', 'The group cites latency below 300 ms (ideally below 200 ms), surgical-grade redundancy, failover notices, 99.999% uptime, credentialed bedside coverage for high-risk portions, risk disclosure, shared liability, and registries.', 'Consensus recommendations as summarized in the group report.'],
        ['E16', 'Rocco et al. (2024)', 'Telesurgery latency discussion', 'The group cites below 200 ms as ideal and up to 300 ms as acceptable, with surgeons compensating beyond that.', 'Expert-conference summary cited in the group report.'],
        ['E17', 'Marescaux et al. (2002)', 'Lindbergh operation', 'The group cites a 2001 operation across about 14,000 km with a constant 155 ms delay over a dedicated priority network.', 'Historical benchmark cited in the group report.'],
        ['E18', 'Taylor v. Intuitive Surgical, 187 Wash. 2d 743, 389 P.3d 517 (2017)', 'Duty-to-warn case cited by the group', 'The group uses Taylor to ask what the manufacturer communicated to the purchasing hospital about the limits of its device.', 'The report raises a legal issue for discussion.'],
        ['E19', 'Yang et al. (2017)', 'Levels of autonomy', 'The group classifies SteadyPath as assistive shared control using the levels-of-autonomy framework.', 'The classification is the group’s application to the simulated system.']
      ].map(([id, source, title, detail, limits]) => record(id, { title, status: 'Group source', source, detail, limits }))
    ],
    gaps: [
      record('G01', { title: 'Who validates the system under abnormal delay?', phase: phases[0], type: 'Active responsibility', status: 'Gap supported', mechanism: 'Integrated testing had no named owner in the three simulated contracts.', reason: 'Axion knew the device limits, while RCH held contract authority. RCH should own the full operating envelope, Axion the device safe-stop, and NorthLink the failover alert.', alternative: 'RCH and Axion may also have left existing duties unfulfilled. A signed integrated test plan assigning ownership would change this judgment.', actors: ['P03', 'P04', 'P05'], events: ['T16', 'T17'], evidence: ['E03', 'E10', 'E11'], actions: ['A01', 'A02', 'A03', 'A05', 'A06'] }),
      record('G02', { title: 'Who deserves blame?', phase: phases[2], type: 'Moral culpability', status: 'Apparent gap', mechanism: 'The update, contract, staffing and failover choices are traceable to organizations with relevant control.', reason: 'The group finds plausible organizational wrongdoing. The smooth input and limited information weaken the case for blaming the surgeon.', alternative: 'Release records and contract review could clarify what particular individuals could foresee.', actors: ['P01', 'P03', 'P04', 'P05'], evidence: ['E09', 'E10', 'E11', 'E13'], actions: ['A04'] }),
      record('G03', { title: 'Who can and must explain the outcome?', phase: phases[2], type: 'Moral accountability', status: 'Gap supported · repairable', mechanism: 'Three custodians hold different logs, clocks differ, and Axion holds the keys to the model buffer.', reason: 'A coordinated record and independent investigation could reconstruct how the input became the observed movement.', actors: ['P03', 'P04', 'P05'], events: ['T11', 'T12'], evidence: ['E02', 'E13'], actions: ['A04', 'A10'] }),
      record('G04', { title: 'Who answers to the patient, regulators, and public?', phase: phases[2], type: 'Public accountability', status: 'Gap supported', mechanism: 'Each organization gives a partial account and points to the others.', reason: 'A joint account needs a named coordinator, participation from all three organizations, and a way for the patient to ask questions.', alternative: 'Joint communications and escalation records could identify an already assigned lead.', actors: ['P02', 'P03', 'P04', 'P05', 'P10'], events: ['T06'], evidence: ['E01', 'E04', 'E11'], actions: ['A04', 'A08', 'A11'] }),
      record('G05', { title: 'Who must act to prevent recurrence?', phase: phases[0], type: 'Active responsibility', status: 'Gap supported', mechanism: 'Keeping total latency in the validated envelope, failing safely, and preserving a synchronized record span three contracts.', reason: 'Assign end-to-end oversight to RCH, safe-stop to Axion, and real-time failover notice and network capture to NorthLink.', actors: ['P03', 'P04', 'P05'], evidence: ['E06', 'E09', 'E10', 'E11', 'E13', 'E15'], actions: ['A01', 'A03', 'A05', 'A06', 'A09', 'A10'] }),
      record('G06', { title: 'Does Matthias’s learning-system gap apply?', phase: phases[2], type: 'Moral culpability', status: 'Gap not established', mechanism: 'SteadyPath is locked in operation. Human approval and validation decisions occur at release.', reason: 'The specific instrument trajectory was uncertain, while failure beyond the tested latency envelope was foreseeable. The group applies Matthias’s test and Tigard’s counterargument.', actors: ['P04', 'P07'], events: ['T12', 'T16'], evidence: ['E08', 'E10'], actions: ['A02'] })
    ],
    actions: [
      record('A01', { title: 'Detect stale commands and add a latency-gated safe-stop', phase: 'Before resuming', owner: 'P04', actors: ['P03', 'P05'], resources: 'Axion can change the controller. Test the group’s proposed gates for disabling prediction above 200 ms, stopping motion above 300 ms or on bursty arrival, and alerting both sites.', verification: 'Update the hazard analysis and replay the incident trace on the bench.', events: ['T10', 'T11', 'T12'], evidence: ['E08', 'E09', 'E10', 'E15'] }),
      record('A02', { title: 'Retest updates and communicate latency limits', phase: 'Before resuming', owner: 'P04', actors: ['P03'], resources: 'Add degraded-network data to the PCCP test set and publish limits in the console, warnings, guide and training.', verification: 'Review revised test records, labeling, and training.', events: ['T16'], evidence: ['E08', 'E10'] }),
      record('A03', { title: 'Review integrated behavior under abnormal latency', phase: 'Before resuming', owner: 'P03', actors: ['P04', 'P05'], deadline: 'Before a decision to resume remote use', verification: 'Document simulated delay and disconnection tests, alert and pause behavior, named owners, and review sign-off.', events: ['T02', 'T03', 'T04'], evidence: ['E03', 'E11'] }),
      record('A04', { title: 'Coordinate reporting and independent investigation', phase: 'Incident response', owner: 'P04', actors: ['P03', 'P10', 'P05'], resources: 'Axion and RCH coordinate applicable device incident reports and give an independent investigator access to records.', verification: 'Track report submissions and share the investigation findings with the parties.', evidence: ['E13', 'E14'] }),
      record('A05', { title: 'Alert both sites on failover and capture packet data', phase: 'Before resuming', owner: 'P05', actors: ['P03', 'P04'], resources: 'Revise the service agreement for surgical-grade availability, real-time alerts, and packet-level capture during procedures.', verification: 'Review the signed service agreement and the failover drill logs.', events: ['T08', 'T09'], evidence: ['E06', 'E11', 'E15'] }),
      record('A06', { title: 'Name a hospital system-safety owner', phase: 'Before resuming', owner: 'P03', actors: ['P01', 'P09'], resources: 'Require clinical engineering and committee contract review, degraded-network credentialing, scrubbed bedside coverage for high-risk procedures, and specific consent.', verification: 'Audit policy, drill records, staffing and consent.', events: ['T17', 'T18', 'T19'], evidence: ['E09', 'E11', 'E12', 'E15'] }),
      record('A07', { title: 'Rehearse recognition of delay and suspension', phase: 'Before resuming', owner: 'P01', actors: ['P03', 'P09'], resources: 'RCH funds simulator drills that complement technical safeguards.', verification: 'Review the simulator and escalation records.', events: ['T10', 'T18'], evidence: ['E09', 'E11'] }),
      record('A08', { title: 'Coordinate compensation and continuing care', phase: 'Incident response', owner: 'P03', actors: ['P02', 'P04', 'P05'], resources: 'The three organizations and their insurers coordinate support promptly and settle allocation afterwards.', verification: 'Confirm continuing care costs are covered and document the outcome.', events: ['T13'], evidence: ['E14', 'E15'] }),
      record('A09', { title: 'Develop a telesurgery registry and network standards', phase: 'Long-term prevention', owner: 'P10', resources: 'Professional bodies and the regulator coordinate registry and standards work.', verification: 'Check that the registry captures network conditions and failover events.', evidence: ['E15'] }),
      record('A10', { title: 'Preserve and synchronize incident records', phase: 'Incident response', owner: 'P03', actors: ['P04', 'P05'], deadline: 'Flag the SteadyPath buffer within 24 hours', resources: 'Agree on an independent custodian, access permissions, versions, timestamp alignment, and retention.', verification: 'Check that the three records can trace the same command.', events: ['T11', 'T12'], evidence: ['E02', 'E13'] }),
      record('A11', { title: 'Explain the incident and coordinate patient support', phase: 'Incident response', owner: 'P03', actors: ['P02', 'P04', 'P05'], verification: 'Document the patient’s questions, the information shared, and the next contact date.', events: ['T06', 'T13'], evidence: ['E04', 'E14'] })
    ],
    claims: [
      record('M01', { title: 'Four conditions enabled the injury', model: modelNames[0], status: 'Supported', reason: 'The group’s counterfactual analysis tests the burst, model extrapolation, missing degradation-triggered safe-stop, and proximity of the artery. Removing any one could have prevented this injury.', actors: ['P04', 'P05', 'P07', 'P08'], events: ['T11', 'T12', 'T13'], evidence: ['E06', 'E07', 'E08', 'E09'] }),
      record('M02', { title: 'Contracting and release decisions created exposure', model: modelNames[0], status: 'Supported', reason: 'The best-effort contract and the release without degraded-network testing each exposed the system to a known class of hazard.', alternative: 'Exposure to a hazard alone cannot explain the exact movement or injury.', actors: ['P03', 'P04'], events: ['T16', 'T17'], evidence: ['E10', 'E11'] }),
      record('M03', { title: 'The remote surgeon contributed input', model: modelNames[0], status: 'Supported', reason: 'The surgeon supplies the input. Simulated logs show smooth motion, and training omitted the latency limit. Practical control was limited during the 160 ms overshoot.', alternative: 'Operator error is a competing hypothesis. Aligned input and output logs and a verified reaction interval could test it.', actors: ['P01'], events: ['T10', 'T12', 'T14'], evidence: ['E02', 'E09', 'E10', 'E13'] }),
      record('M04', { title: 'Causal contribution and blame require separate judgments', model: modelNames[0], status: 'Supported', reason: 'Several parties supplied conditions in the causal chain. Use van de Poel and Royakkers’s criteria of wrongdoing, causal contribution, foreseeability and freedom to assess blame.', actors: ['P01', 'P03', 'P04', 'P05'], evidence: ['E01', 'E06', 'E08', 'E09', 'E10', 'E11', 'E13'] }),
      record('M05', { title: 'Omissions matter at each interface', model: modelNames[0], status: 'Supported', reason: 'Missing integrated tests, failover alerts, actionable guidance, degraded-network training and scrubbed backup left the team exposed.', actors: ['P03', 'P04', 'P05', 'P09'], events: ['T09', 'T10', 'T15', 'T17', 'T18'], evidence: ['E06', 'E09', 'E10', 'E11'] }),
      record('M06', { title: 'Blameworthiness · Axion', model: modelNames[0], status: 'Supported', reason: 'Axion contributed the controller behavior. The group sees plausible wrongdoing in the untested update and inaccessible warning. Foreseeability was high and Axion controlled the release and safeguards.', actors: ['P04'], evidence: ['E08', 'E09', 'E10'] }),
      record('M07', { title: 'Blameworthiness · RCH', model: modelNames[0], status: 'Supported', reason: 'RCH contributed exposure and the delayed takeover. The group sees plausible wrongdoing in the unreviewed contract, missing integrated test, staffing and generic consent. Foreseeability was moderate to high and RCH controlled these arrangements.', actors: ['P03'], evidence: ['E09', 'E11', 'E12'] }),
      record('M08', { title: 'Blameworthiness · NorthLink', model: modelNames[0], status: 'Contested', reason: 'NorthLink contributed through failover and controlled configuration. The group’s judgment depends on whether NorthLink knew the service supported live surgery, since the simulated service met the best-effort terms.', actors: ['P05'], evidence: ['E06', 'E11'] }),
      record('M09', { title: 'Knowledge and authority sat with different organizations', model: modelNames[1], status: 'Supported', reason: 'Axion knew the model’s envelope. RCH had the contract authority. NorthLink controlled network failover. The assumed contracts left end-to-end safety unassigned.', actors: ['P03', 'P04', 'P05'], evidence: ['E06', 'E10', 'E11'] }),
      record('M10', { title: 'Contracting and clinical review were separated within RCH', model: modelNames[1], status: 'Supported', reason: 'The CFO signed the contract. The telesurgery committee had clinical authority, while neither it nor clinical engineering reviewed the agreement.', actors: ['P03'], events: ['T17'], evidence: ['E11'] }),
      record('M11', { title: 'Combine hierarchical, collective, and individual responsibility', model: modelNames[1], status: 'Supported', reason: 'Apply van de Poel and Royakkers’s three approaches. Trace management approval for the contract and release, organizational responsibility for system safety, and individual responsibility according to actual contribution.', alternative: 'Seniority or employment alone does not establish individual blame.', actors: ['P01', 'P03', 'P04', 'P05'], evidence: ['E09', 'E10', 'E11'] }),
      record('M12', { title: 'The last human in the chain had limited control', model: modelNames[1], status: 'Supported', reason: 'The group applies Elish’s moral crumple zone to the risk of blaming the surgeon while control of the safeguards sat elsewhere.', actors: ['P01', 'P03', 'P04', 'P05'], evidence: ['E09', 'E10', 'E11', 'E13'] }),
      record('M13', { title: 'Warnings, institutional duties, and contract exposure', model: modelNames[1], status: 'Contested', reason: 'The group asks whether Axion’s warnings reached the hospital and surgeon, whether RCH’s credentialing, staffing and procurement met its duties, and what NorthLink accepted in its contract.', alternative: 'The conclusions would require actual documentation and a jurisdiction-specific legal analysis.', actors: ['P03', 'P04', 'P05'], evidence: ['E03', 'E10', 'E11', 'E18'] }),
      record('M14', { title: 'Encode a safeguard for stale commands', model: modelNames[2], status: 'Supported', reason: 'Apply Santoni de Sio and van den Hoven’s meaningful human control framework. A controller should reject stale input before the operator faces a 160 ms correction window.', actors: ['P01', 'P04', 'P07'], events: ['T11', 'T12'], evidence: ['E08', 'E09', 'E10'] }),
      record('M15', { title: 'Organizations should coordinate repair and prevention', model: modelNames[2], status: 'Supported', reason: 'Young’s social connection approach supports coordinated action by the organizations that shape the arrangement. Care and investigation can proceed while allocation remains disputed.', actors: ['P02', 'P03', 'P04', 'P05'], evidence: ['E11', 'E13', 'E14', 'E15'] })
    ],
    conclusions: {
      causal: 'In the reconstruction, NorthLink’s silent failover bunches commands, Axion’s model amplifies them without a degradation-triggered stop, and RCH’s decisions expose the patient and slow the rescue. The surgeon supplied input. The group’s strongest objection is operator error, but the simulated input was smooth, the quick guide omitted the limit, and the motion lasted 160 ms. Aligning the logs and reconciling the warning-to-release interval remain open. (E06–E14)',
      organization: 'The group places primary backward-looking responsibility on Axion for the update and warnings and RCH for contracting and governance. NorthLink has a narrower role through failover, and the surgeon had limited control. No party owned the full latency envelope. Individual blame still depends on what each person knew and could do. The actual contract, warning distribution and approval records would test this conclusion. (E03, E09–E11, E13)',
      future: 'Coordinate patient compensation and independent investigation now. Axion should test degraded-network behavior and add a safe-stop, NorthLink should announce failover, and RCH should own system safety and revise credentialing and consent before resuming. Allocating by capacity can burden the party best able to help, so document who pays and why separately from immediate support. (E08–E15)',
      comparison: 'The causal model traces how the injury occurred. The organizational model explains who could provide missing safeguards. The forward-looking model assigns owners for repair while the facts are still being investigated. Reading them together exposes both the risk of scapegoating the surgeon and the risk of diffusing responsibility across the system.',
      gap: 'The group finds active-responsibility and public-accountability gaps, with a repairable explanation gap from fragmented logs. The model is locked and the hazard class was foreseeable, so the group finds no learning-system gap under Matthias’s test. RCH can own the operating envelope, Axion the device safeguards, and NorthLink the failover notice. (E08, E10, E11, E13)',
      legal: 'The report raises possible warning and design issues for Axion, institutional negligence questions for RCH, and contract exposure for NorthLink. It cites Taylor as a starting point for the warning question. The group proposes patient support while legal allocation is resolved. (E10, E11, E14, E18)',
      reflection: 'A person can intervene only if they can understand the system, influence it and stop it in time. Components that each meet their specifications can still be unsafe together. A colored line can suggest more certainty than the evidence supports. A further improvement would give each stakeholder separate evidence-backed assessments for causal contribution, foreseeability, control, duty and accountability, with open questions visible next to assumptions.',
      evidence: ['E01', 'E02', 'E03', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E19']
    }
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
