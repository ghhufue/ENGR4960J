import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProject, exportNotes, normalizeProject } from '../src/project.js';

test('the example distinguishes case facts, simulated reconstruction, sources, and proposed actions', () => {
  const project = createProject();
  assert.equal(project.evidence[0].status, 'Teacher brief');
  assert.equal(project.evidence[1].status, 'To obtain');
  assert.equal(project.events.find(item => item.id === 'T01').status, 'Teacher brief');
  assert.equal(project.events.find(item => item.id === 'T08').status, 'Simulated material');
  assert.equal(project.evidence.find(item => item.id === 'E06').locator, 'A2');
  assert.equal(project.evidence.find(item => item.id === 'E15').status, 'Group source');
  assert.ok(project.causes.every(link => link.evidence.length));
  assert.ok(project.actions.every(action => action.status === 'Proposed'));
  assert.equal(project.gaps[0].status, 'Gap supported');
  assert.ok(['causal', 'organization', 'future', 'gap'].every(key => project.conclusions[key].length));
});

test('JSON round trips keep archived evidence connected to conclusions and gaps', () => {
  const project = createProject();
  project.evidence.find(item => item.id === 'E03').archived = true;
  project.conclusions.organization = 'The division of duties needs more evidence.';
  project.conclusions.evidence = ['E03'];
  const restored = normalizeProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(restored, project);
  const notes = exportNotes(restored);
  assert.ok(notes.includes('E03 · Sign-off, test, and escalation records (Archived)'));
  assert.ok(notes.includes('The division of duties needs more evidence.'));
});

test('imports reject broken references, duplicate IDs, invalid URLs, and self-links', () => {
  const project = createProject();
  project.gaps[0].actions = ['A99'];
  assert.throws(() => normalizeProject(project), /Missing referenced record/);
  project.gaps[0].actions = ['A03'];
  project.events.push(project.events[0]);
  assert.throws(() => normalizeProject(project), /repeated record ID/);
  project.events.pop();
  project.evidence[0].url = 'javascript:alert(1)';
  assert.throws(() => normalizeProject(project), /must use HTTP or HTTPS/);
  project.evidence[0].url = '';
  project.causes[0].to = project.causes[0].from;
  assert.throws(() => normalizeProject(project), /different endpoints/);
});
