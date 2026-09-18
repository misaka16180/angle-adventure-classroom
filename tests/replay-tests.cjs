/* Prefix reuse is observable behavior, not a cache of unplayed simulation. */
const assert = require('node:assert/strict');
const Engine = require('../app/engine.js');
const Replay = require('../app/replay.js');
let passed = 0;
const test = (name, run) => { run(); passed += 1; console.log('PASS ' + name); };
const move = (value, blockId) => ({type: 'move', value, blockId});
const left = (value, blockId) => ({type: 'left', value, blockId});
const loop = (id, value, body) => [{type: 'repeat', id, value}, ...body, {type: 'endRepeat', id}];
const watched = (commands, cursor, levelId = 1) => {
  const result = Engine.simulate(commands, {levelId});
  return {commands, result, cursor: cursor === undefined ? result.frames.length - 1 : cursor};
};

test('first run begins at the start', () => {
  const next = Replay.prepare([move(3)], {levelId: 1});
  assert.equal(next.cursor, 0);
  assert.equal(next.reusedCommands, 0);
  assert.equal(next.rewound, false);
});
test('appending a return route keeps delivery and the visible endpoint', () => {
  const previous = watched([move(3)]);
  const next = Replay.prepare([...previous.commands, left(180), move(3), left(180)], {levelId: 1, previous});
  assert.equal(next.cursor, 3);
  assert.equal(next.reusedCommands, 1);
  assert.deepEqual(next.result.frames[next.cursor].delivered, [1]);
  assert.equal(next.result.status, 'success');
  assert.equal(next.rewound, false);
  assert.equal(next.changed, true);
});
test('an untouched paused move resumes only after its watched grids', () => {
  const previous = watched([move(6), left(90)], 2);
  const next = Replay.prepare(previous.commands, {levelId: 1, previous});
  assert.equal(next.cursor, 2);
  assert.equal(next.reusedCommands, 0);
  assert.equal(next.result.frames[next.cursor + 1].x, 3);
  assert.equal(next.changed, false);
});
test('appending while paused never skips unwatched route frames', () => {
  const previous = watched([move(6)], 2);
  const next = Replay.prepare([...previous.commands, left(90)], {levelId: 1, previous});
  assert.equal(next.cursor, 2);
  assert.equal(next.reusedCommands, 0);
});
test('editing a partially watched move retries that entire move', () => {
  const previous = watched([left(90), move(3)], 3);
  const next = Replay.prepare([left(90), move(2)], {levelId: 1, previous});
  assert.equal(next.cursor, 1);
  assert.equal(next.reusedCommands, 1);
  assert.equal(next.rewound, true);
  assert.equal(next.result.frames[next.cursor].y, 0);
});
test('editing an earlier action rewinds before it', () => {
  const previous = watched([move(3), left(90), move(3)]);
  const next = Replay.prepare([move(2), left(90), move(3)], {levelId: 1, previous});
  assert.equal(next.cursor, 0);
  assert.equal(next.rewound, true);
});
test('correcting a boundary error retries the failed move rather than double-moving', () => {
  const previous = watched([move(3), move(6)]);
  assert.equal(previous.result.status, 'error');
  assert.equal(previous.result.final.x, 6);
  const next = Replay.prepare([move(3), move(2)], {levelId: 1, previous});
  assert.equal(next.cursor, 3);
  assert.equal(next.result.frames[next.cursor].x, 3);
  assert.equal(next.reusedCommands, 1);
  assert.equal(next.result.frames[next.cursor + 1].x, 4);
});
test('an unchanged boundary error retains its partial move without extra steps', () => {
  const previous = watched([move(3), move(6)]);
  const next = Replay.prepare(previous.commands, {levelId: 1, previous});
  assert.equal(next.cursor, previous.cursor);
  assert.equal(next.reusedCommands, 1);
  assert.equal(next.result.status, 'error');
  assert.equal(next.cursor, next.result.frames.length - 1);
});
test('changing a second-iteration loop body retries its first entry', () => {
  const previous = watched([left(360), ...loop('a', 2, [move(3), left(180)])], 7);
  assert.equal(previous.result.frames[previous.cursor].iterations[0].iteration, 2);
  const next = Replay.prepare([left(360), ...loop('a', 2, [move(2), left(180)])], {levelId: 1, previous});
  assert.equal(next.cursor, 1);
  assert.equal(next.reusedCommands, 1);
});
test('changing a loop count retries the loop, even if its first iteration is identical', () => {
  const previous = watched([left(360), ...loop('a', 2, [move(3), left(180)])], 7);
  const next = Replay.prepare([left(360), ...loop('a', 3, [move(3), left(180)])], {levelId: 1, previous});
  assert.equal(next.cursor, 1);
  assert.equal(next.rewound, true);
});
test('an inner body change invalidates its enclosing loop context', () => {
  const previous = watched([left(360), ...loop('outer', 2, loop('inner', 2, [left(90)]))]);
  const next = Replay.prepare([left(360), ...loop('outer', 2, loop('inner', 2, [left(180)]))], {levelId: 1, previous});
  assert.equal(next.cursor, 1);
});
test('changing plain actions into a loop is a structural edit', () => {
  const previous = watched([left(90), left(90)]);
  const next = Replay.prepare(loop('a', 2, [left(90)]), {levelId: 1, previous});
  assert.equal(next.cursor, 0);
  assert.equal(next.changed, true);
});
test('renaming IDs and replacing same-value blocks preserves execution', () => {
  const previous = watched(loop('old', 2, [move(3, 'old-move'), left(180, 'old-turn')]));
  const commands = loop('new', 2, [move(3, 'new-move'), left(180, 'new-turn')]);
  commands.forEach((command, index) => command.sourceIndex = index + 100);
  const next = Replay.prepare(commands, {levelId: 1, previous});
  assert.equal(next.cursor, previous.cursor);
  assert.equal(next.changed, false);
  assert.equal(next.reusedCommands, 4);
});
test('undo back to the previously run program reuses the whole watched prefix', () => {
  const previous = watched([move(3), left(180), move(3)]);
  const editedButNotRun = [move(2), left(180), move(3)];
  assert.notDeepEqual(editedButNotRun, previous.commands);
  const restored = previous.commands.map(command => ({...command}));
  const next = Replay.prepare(restored, {levelId: 1, previous});
  assert.equal(next.cursor, previous.cursor);
  assert.equal(next.changed, false);
});
test('removing a tail stops at the shorter valid prefix', () => {
  const previous = watched([move(3), left(180), move(3)]);
  const next = Replay.prepare([move(3)], {levelId: 1, previous});
  assert.equal(next.cursor, 3);
  assert.equal(next.reusedCommands, 1);
  assert.equal(next.rewound, true);
});
test('single-action rewind retracts all grids and deliveries of that move', () => {
  const previous = watched([left(360), move(3)]);
  const cursor = Replay.rewindCursor(previous.result, previous.cursor);
  assert.equal(cursor, 1);
  assert.deepEqual(previous.result.frames[cursor].delivered, []);
  assert.equal(previous.result.frames[cursor].x, 0);
});
test('rewind during a multi-grid move also returns to its beginning', () => {
  const previous = watched([left(360), move(3)], 3);
  assert.equal(Replay.rewindCursor(previous.result, previous.cursor), 1);
});
test('rewind a turn restores the previous heading and preserves earlier delivery', () => {
  const previous = watched([move(3), left(90)]);
  const cursor = Replay.rewindCursor(previous.result, previous.cursor);
  assert.equal(cursor, 3);
  assert.equal(previous.result.frames[cursor].heading, 0);
  assert.deepEqual(previous.result.frames[cursor].delivered, [1]);
});
test('compile errors and start-only results safely reset to the start', () => {
  const previous = watched([move(3)]);
  const next = Replay.prepare([{type: 'repeat', id: 'open', value: 2}, move(3)], {levelId: 1, previous});
  assert.equal(next.result.status, 'error');
  assert.equal(next.result.frames.length, 1);
  assert.equal(next.cursor, 0);
  assert.equal(Replay.rewindCursor(next.result, 999), 0);
  assert.equal(Replay.rewindCursor({frames: [{kind: 'start'}, {kind: 'compileerror'}]}, 1), 0);
  assert.equal(Replay.rewindCursor(null, 10), 0);
});
test('corrected compile errors never pretend the unrun route was watched', () => {
  const previous = watched([{type: 'repeat', id: 'open', value: 2}, move(3)]);
  const next = Replay.prepare([move(3)], {levelId: 1, previous});
  assert.equal(next.cursor, 0);
  assert.equal(next.reusedCommands, 0);
});
test('invalid cursors and absent old frames are safe', () => {
  assert.equal(Replay.prepare([move(3)], {previous: {commands: [move(3)], result: {}, cursor: 20}}).cursor, 0);
  assert.equal(Replay.rewindCursor(Engine.simulate([move(3)]), NaN), 0);
  assert.equal(Replay.rewindCursor(Engine.simulate([move(3)]), -2), 0);
});
test('a new target order cannot reuse a different delivered state', () => {
  const commands = [move(6), left(90), move(3)];
  const previous = watched(commands, undefined, 3);
  const next = Replay.prepare(commands, {levelId: 1, previous});
  assert.equal(next.cursor, 5);
  assert.deepEqual(next.result.frames[next.cursor].delivered, [1]);
});

console.log('\n' + passed + ' replay tests passed.');
