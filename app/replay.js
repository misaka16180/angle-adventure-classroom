/* Reuse only the program prefix students have actually watched. */
(function (root, factory) {
  'use strict';
  const replay = factory(typeof module === 'object' && module.exports
    ? require('./engine.js') : root.RobotEngine);
  if (typeof module === 'object' && module.exports) module.exports = replay;
  if (root) root.RobotReplay = replay;
})(typeof window !== 'undefined' ? window : null, function (Engine) {
  'use strict';

  // Block IDs and source indices describe the editor, not program behavior.
  // A loop's whole body is part of every action's context: editing it must
  // retry that loop from its first entry, even during a later iteration.
  function describe(commands) {
    try {
      const compiled = Engine.compile(commands);
      const loops = new Map();
      function semantic(node) {
        if (node.type !== 'repeat') return [node.type, node.value];
        const value = ['repeat', node.value, node.body.map(semantic)];
        loops.set(node.id, value);
        return value;
      }
      const program = JSON.stringify(compiled.ast.map(semantic));
      const actions = compiled.expanded.map(command => JSON.stringify([
        command.type, command.value,
        command.iterations.map(loop => [
          loops.get(loop.id), loop.iteration, loop.times
        ])
      ]));
      return { program, actions };
    } catch (error) {
      // An unfinished C-block or imported invalid program has no executable
      // prefix. Still provide a stable comparison for the UI's dirty state.
      const tokens = Array.isArray(commands) ? commands.map(command => (
        command && typeof command === 'object'
          ? [String(command.type), String(command.value)] : [typeof command, String(command)]
      )) : String(commands);
      return { program: JSON.stringify(['invalid', tokens, error.message]), actions: [] };
    }
  }

  function clampCursor(result, cursor) {
    const frames = result && Array.isArray(result.frames) ? result.frames : [];
    const value = Number.isFinite(cursor) ? Math.floor(cursor) : 0;
    return Math.max(0, Math.min(value, Math.max(0, frames.length - 1)));
  }

  function sameFrame(a, b) {
    if (!a || !b) return false;
    return a.kind === b.kind && a.commandIndex === b.commandIndex
      && a.x === b.x && a.y === b.y && a.heading === b.heading
      && a.step === b.step && a.commandDistance === b.commandDistance
      && JSON.stringify(a.delivered || []) === JSON.stringify(b.delivered || []);
  }

  function completedCommands(result, cursor) {
    let count = 0;
    const frames = result && Array.isArray(result.frames) ? result.frames : [];
    for (let index = 1; index <= cursor; index += 1) {
      const frame = frames[index];
      if (frame.kind === 'turn'
          || (frame.kind === 'move' && frame.step === frame.commandDistance)) count += 1;
    }
    return count;
  }

  function prepare(commands, options) {
    options = options || {};
    const result = Engine.simulate(commands, { levelId: options.levelId });
    const current = describe(commands);
    const previous = options.previous;
    if (!previous) {
      return { result, cursor: 0, reusedCommands: 0, rewound: false, changed: true };
    }
    const old = describe(previous.commands);
    const oldCursor = clampCursor(previous.result, previous.cursor);
    let common = 0;
    while (common < current.actions.length && common < old.actions.length
        && current.actions[common] === old.actions[common]) common += 1;

    let cursor = 0;
    const oldFrames = previous.result && Array.isArray(previous.result.frames)
      ? previous.result.frames : [];
    // Simulation can know the whole route, but only visible frames may be
    // skipped. In particular, a paused multi-grid move keeps its remaining
    // steps, whereas a changed move cannot reuse any of its earlier steps.
    for (let index = 1; index <= oldCursor && index < result.frames.length; index += 1) {
      const frame = result.frames[index];
      if (!Number.isInteger(frame.commandIndex) || frame.commandIndex < 0
          || frame.commandIndex >= common || !sameFrame(oldFrames[index], frame)) break;
      cursor = index;
    }
    return {
      result, cursor, reusedCommands: completedCommands(result, cursor),
      rewound: cursor < oldCursor, changed: current.program !== old.program
    };
  }

  function rewindCursor(result, cursor) {
    const frames = result && Array.isArray(result.frames) ? result.frames : [];
    let index = clampCursor(result, cursor);
    if (!index) return 0;
    const commandIndex = frames[index] && frames[index].commandIndex;
    if (!Number.isInteger(commandIndex) || commandIndex < 0) return 0;
    while (index > 0 && frames[index].commandIndex === commandIndex) index -= 1;
    return index;
  }

  return { prepare, rewindCursor };
});
