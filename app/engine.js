/* Shared, deterministic mathematics model. No DOM, network, or timers. */
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.RobotEngine = engine;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const start = Object.freeze({ x: 0, y: 0, heading: 0 });
  const bounds = Object.freeze({ minX: 0, maxX: 6, minY: 0, maxY: 3 });
  const MAX_OPERATIONS = 128;
  const MAX_NESTING = 4;
  const tables = [
    { id: 1, x: 3, y: 0 },
    { id: 2, x: 6, y: 0 },
    { id: 3, x: 6, y: 3 },
    { id: 4, x: 3, y: 3 },
    { id: 5, x: 0, y: 3 }
  ];
  const move = value => ({ type: 'move', value });
  const left = value => ({ type: 'left', value });
  const levels = [
    {
      id: 1,
      title: '初次送餐',
      subtitle: '送到 ① 号桌，回到取餐口，并重新朝向 ① 号桌。',
      targets: [1],
      restoreHeading: true,
      solution: [move(3), left(180), move(3), left(180)],
      loopSolution: { times: 2, commands: [move(3), left(180)] }
    },
    {
      id: 2,
      title: '正方形巡游',
      subtitle: '按 ① → ④ → ⑤ 送餐，回到取餐口，并恢复出发朝向。',
      targets: [1, 4, 5],
      restoreHeading: true,
      solution: [move(3), left(90), move(3), left(90), move(3), left(90), move(3), left(90)],
      loopSolution: { times: 4, commands: [move(3), left(90)] }
    },
    {
      id: 3,
      title: '全桌大挑战',
      subtitle: '按 ① → ② → ③ → ④ → ⑤ 送餐，回到取餐口，并恢复出发朝向。',
      targets: [1, 2, 3, 4, 5],
      restoreHeading: true,
      solution: [move(6), left(90), move(3), left(90), move(6), left(90), move(3), left(90)],
      loopSolution: { times: 2, commands: [move(6), left(90), move(3), left(90)] }
    }
  ];

  function normalizeHeading(value) {
    return ((value % 360) + 360) % 360;
  }

  function directionName(heading) {
    const normalized = normalizeHeading(heading);
    return { 0: '右', 90: '上', 180: '左', 270: '下' }[normalized] || '偏转 ' + normalized + '°';
  }

  function angleName(degrees) {
    if (degrees < 90) return '锐角';
    if (degrees === 90) return '直角';
    if (degrees < 180) return '钝角';
    if (degrees === 180) return '平角';
    if (degrees < 360) return '超过半周';
    return '周角';
  }

  function compile(commands, options = {}) {
    if (!Array.isArray(commands)) throw new TypeError('指令必须放在一个列表中。');
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('编程设置必须是一个对象。');
    }
    const repeat = options.repeat === undefined ? 1 : options.repeat;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 8) {
      throw new RangeError('循环次数应是 1～8 的整数。');
    }
    const ast = [];
    const stack = [];
    const loopIds = new Set();
    const fail = (index, message, ErrorType = RangeError) => {
      const error = new ErrorType('第 ' + (index + 1) + ' 块积木：' + message);
      error.sourceIndex = index;
      throw error;
    };
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      if (!command || typeof command !== 'object' || Array.isArray(command)) {
        fail(index, '请选择直行、转向、循环开始或循环结束积木。', TypeError);
      }
      const body = stack.length ? stack[stack.length - 1].body : ast;
      if (command.type === 'repeat') {
        if (typeof command.id !== 'string' || !command.id.trim()) {
          fail(index, '循环开始块缺少有效的配对标记。');
        }
        if (loopIds.has(command.id)) fail(index, '循环开始块的配对标记重复了，每组循环需要独立的标记。');
        if (!Number.isInteger(command.value) || command.value < 1 || command.value > 8) {
          fail(index, '循环次数应是 1～8 的整数。');
        }
        if (stack.length >= MAX_NESTING) fail(index, '循环最多嵌套 ' + MAX_NESTING + ' 层，请把这组循环移到外面。');
        const node = { type: 'repeat', value: command.value, id: command.id, sourceIndex: index, body: [] };
        body.push(node);
        stack.push(node);
        loopIds.add(command.id);
        continue;
      }
      if (command.type === 'endRepeat') {
        if (typeof command.id !== 'string' || !command.id.trim()) {
          fail(index, '循环结束块缺少有效的配对标记。');
        }
        if (!stack.length) fail(index, '这个循环结束块没有对应的循环开始块，请先放好开始位置。');
        const open = stack[stack.length - 1];
        if (open.id !== command.id) {
          const matching = stack.find(node => node.id === command.id);
          if (matching) {
            fail(index, '循环范围发生交叉！请先结束第 ' + (open.sourceIndex + 1) + ' 块开始的内层循环，再结束外层循环。');
          }
          fail(index, '循环开始和结束不匹配。当前需要配对第 ' + (open.sourceIndex + 1) + ' 块的循环开始。');
        }
        if (!open.body.length) fail(index, '这是空循环。请把要重复执行的动作拖进紫色 C 形槽。');
        open.endSourceIndex = index;
        stack.pop();
        continue;
      }
      if (!['move', 'left', 'right'].includes(command.type)) {
        fail(index, '只能使用直行、左转、右转、循环开始或循环结束。', TypeError);
      }
      if (command.type === 'move') {
        if (!Number.isInteger(command.value) || command.value < 1 || command.value > 6) {
          fail(index, '直行距离应是 1～6 格的整数。');
        }
      } else if (!Number.isInteger(command.value) || command.value < 1 || command.value > 360) {
        fail(index, '转向角度应是 1～360° 的整数。');
      }
      body.push({ type: command.type, value: command.value, sourceIndex: index });
    }
    if (stack.length) {
      const open = stack[stack.length - 1];
      fail(open.sourceIndex, '这个循环开始块缺少对应的循环结束块，请补上结束位置。');
    }
    const expanded = [];
    const visit = (nodes, iterations) => {
      for (const node of nodes) {
        if (node.type === 'repeat') {
          for (let iteration = 1; iteration <= node.value; iteration += 1) {
            visit(node.body, [...iterations, { id: node.id, iteration, times: node.value }]);
          }
        } else {
          if (expanded.length >= MAX_OPERATIONS) {
            fail(node.sourceIndex, '展开后最多执行 ' + MAX_OPERATIONS + ' 条指令，请减少指令或循环次数。');
          }
          expanded.push({ ...node, iterations: iterations.map(item => ({ ...item })) });
        }
      }
    };
    for (let cycle = 0; cycle < repeat; cycle += 1) {
      visit(ast, []);
    }
    return { expanded, ast };
  }

  function expand(commands, repeat = 1) {
    return compile(commands, { repeat }).expanded.map(command => ({ type: command.type, value: command.value }));
  }

  function toPython(commands) {
    const { ast } = compile(commands);
    const names = { move: 'move', left: 'turn_left', right: 'turn_right' };
    const lines = [];
    let loopNumber = 0;
    const emit = (nodes, depth) => {
      const indent = '    '.repeat(depth);
      for (const node of nodes) {
        if (node.type === 'repeat') {
          loopNumber += 1;
          lines.push(indent + 'for i' + loopNumber + ' in range(' + node.value + '):');
          emit(node.body, depth + 1);
        } else {
          lines.push(indent + names[node.type] + '(' + node.value + ')');
        }
      }
    };
    emit(ast, 0);
    return lines.join('\n');
  }

  function simulate(commands, options = {}) {
    const frames = [];
    const delivered = [];
    const warnings = [];
    const state = { ...start };
    let totalDistance = 0;
    let turns = 0;
    let executedCommands = 0;
    let expanded = [];
    const addFrame = (kind, commandIndex, message, extra = {}) => {
      const command = expanded[commandIndex];
      frames.push({ ...state, commandIndex, sourceIndex: command ? command.sourceIndex : -1,
        iterations: command ? command.iterations.map(item => ({ ...item })) : [],
        kind, delivered: [...delivered], message, ...extra });
    };
    const finish = (status, message, extra = {}) => ({
      frames, status, message, delivered: [...delivered], final: { ...state },
      warnings, totalDistance, turns, executedCommands, ...extra
    });
    addFrame('start', -1, '机器人在取餐口，朝向右边的 ① 号桌。');
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return finish('error', '任务设置格式不正确，请重新选择任务。');
    }
    const levelId = options.levelId === undefined ? 1 : options.levelId;
    const repeat = options.repeat === undefined ? 1 : options.repeat;
    const level = levels.find(item => item.id === levelId);
    if (!level) return finish('error', '请选择任务 1、任务 2 或任务 3。');
    try {
      expanded = compile(commands, { repeat }).expanded;
    } catch (error) {
      return finish('error', error.message, { errorSourceIndex: error.sourceIndex });
    }
    for (let commandIndex = 0; commandIndex < expanded.length; commandIndex += 1) {
      const command = expanded[commandIndex];
      if (command.type !== 'move') {
        state.heading = normalizeHeading(state.heading + (command.type === 'left' ? command.value : -command.value));
        turns += 1;
        const angleDescription = command.value > 180 && command.value < 360
          ? '转过的角度超过半周' : '转过一个' + angleName(command.value);
        const turnName = command.type === 'left' ? '左转' : '右转';
        const headingDescription = state.heading % 90 === 0
          ? '现在朝' + directionName(state.heading) : '现在相对出发方向逆时针偏转 ' + state.heading + '°';
        addFrame('turn', commandIndex,
          turnName + ' ' + command.value + '°，' + angleDescription + '，' + headingDescription + '。',
          { turnDirection: command.type, turnDegrees: command.value });
      } else {
        if (state.heading % 90 !== 0) {
          return finish('error', '当前朝向偏转 ' + state.heading + '°，这张方格餐厅的通道只沿横线或竖线。请先转到上、下、左、右再直行。',
            { errorIndex: commandIndex, errorSourceIndex: command.sourceIndex, expandedCount: expanded.length });
        }
        const vector = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] }[state.heading];
        for (let step = 1; step <= command.value; step += 1) {
          const x = state.x + vector[0];
          const y = state.y + vector[1];
          if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) {
            return finish('error', '第 ' + (commandIndex + 1) + ' 条指令会走出餐厅！机器人停在边界。想一想：应该转弯，还是减少直行格数？',
              { errorIndex: commandIndex, errorSourceIndex: command.sourceIndex, errorStep: step, expandedCount: expanded.length });
          }
          state.x = x;
          state.y = y;
          totalDistance += 1;
          let message = '朝' + directionName(state.heading) + '直行，第 ' + step + ' / ' + command.value + ' 格。';
          let newlyDelivered = null;
          const table = tables.find(item => item.x === x && item.y === y);
          if (table) {
            const expected = level.targets[delivered.length];
            if (table.id === expected) {
              delivered.push(table.id);
              newlyDelivered = table.id;
              message = table.id + ' 号桌送餐成功！' +
                (delivered.length < level.targets.length ? '下一站是 ' + level.targets[delivered.length] + ' 号桌。' : '餐点全部送达，记得回取餐口并恢复出发朝向。');
            } else if (level.targets.includes(table.id) && !delivered.includes(table.id)) {
              message = '经过了 ' + table.id + ' 号桌，但现在应先到 ' + expected + ' 号桌。这次先不送餐，请检查路线顺序。';
              warnings.push({ tableId: table.id, expectedTableId: expected, commandIndex, x, y, message });
            }
          } else if (x === start.x && y === start.y) {
            message = '已回到取餐口。现在朝' + directionName(state.heading) + '，出发时朝右。';
          }
          addFrame('move', commandIndex, message, { step, commandDistance: command.value, newlyDelivered });
        }
      }
      executedCommands += 1;
    }
    const atStart = state.x === start.x && state.y === start.y;
    const headingRestored = state.heading === start.heading;
    const remaining = level.targets.slice(delivered.length);
    const details = { expandedCount: expanded.length, atStart, headingRestored, remaining };
    if (remaining.length) {
      return finish('incomplete', expanded.length === 0
        ? '先添加直行和转向指令，再点击运行。第一站是 ' + level.targets[0] + ' 号桌。'
        : '还有 ' + remaining.join('、') + ' 号桌未按顺序送达。下一站应是 ' + remaining[0] + ' 号桌。', details);
    }
    if (!atStart) return finish('incomplete', '餐点都送到了！还差一步：指挥机器人回到左下方的取餐口。', details);
    if (level.restoreHeading && !headingRestored) {
      const leftDegrees = normalizeHeading(start.heading - state.heading);
      const suggestion = leftDegrees > 180 ? '右转 ' + (360 - leftDegrees) + '°' : '左转 ' + leftDegrees + '°';
      const currentFacing = state.heading % 90 === 0 ? '现在朝' + directionName(state.heading)
        : '当前朝向相对出发方向逆时针偏转 ' + state.heading + '°';
      return finish('incomplete', '已送完餐并回到取餐口，但' + currentFacing + '。出发时朝右，可以再' + suggestion + '恢复出发朝向。', details);
    }
    return finish('success', '任务完成！按顺序送达 ' + delivered.join(' → ') + ' 号桌，回到取餐口，也恢复了出发朝向。', details);
  }

  return { levels, tables, start, bounds, MAX_OPERATIONS, MAX_NESTING, compile, expand, toPython, simulate, normalizeHeading, directionName, angleName };
});
