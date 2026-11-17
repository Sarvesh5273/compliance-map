import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from '../server/index.js';

test('accepts arbitrary activities and three to six distinct locations', () => {
  const parsed = validateInput({ activity: '  Operate a drone photography service  ', places: ['  Ontario, Canada ', 'England, UK', 'Auckland, New Zealand'], context: '  No employees  ' });
  assert.equal(parsed.activity, 'Operate a drone photography service');
  assert.deepEqual(parsed.places, ['Ontario, Canada', 'England, UK', 'Auckland, New Zealand']);
  assert.equal(parsed.context, 'No employees');
  assert.equal(parsed.priority, 'balanced');
});

test('rejects fewer than three places and duplicate places before research is started', () => {
  assert.throws(() => validateInput({ activity: 'Open a café', places: ['Alpha', 'Beta'] }));
  assert.throws(() => validateInput({ activity: 'Open a café', places: ['Alpha', ' ALPHA ', 'Gamma'] }));
});

test('rejects unsupported priorities and malformed or excessive input', () => {
  for (const value of [null, [], { activity: 'x', places: ['Alpha','Beta','Gamma'] }, { activity: 'Open a café', places: ['Alpha',null,'Gamma'] }, { activity: 'Open a café', places: ['Alpha','Beta','Gamma'], priority: 'made-up-score' }, { activity: 'Open a café', places: ['Alpha','Beta','Gamma'], context: 'a'.repeat(2501) }]) assert.throws(() => validateInput(value));
});
