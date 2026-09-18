'use strict';
const assert = require('node:assert/strict');
const engine = require('../app/engine.js');
const move = value => ({ type: 'move', value });
const left = value => ({ type: 'left', value });
const right = value => ({ type: 'right', value });
const repeat = (id, value) => ({ type: 'repeat', id, value });
const end = id => ({ type: 'endRepeat', id });
let passed = 0;
function test(name, body) {
  body();
  passed += 1;
  console.log('PASS ' + name);
}

for (const level of engine.levels) {
  test('任务 ' + level.id + '：教材路线与逐格交付', () => {
    const result = engine.simulate(level.solution, { levelId: level.id });
    assert.equal(result.status, 'success');
    assert.deepEqual(result.delivered, level.targets);
    assert.deepEqual(result.final, engine.start);
    assert.deepEqual(result.frames.filter(frame => frame.newlyDelivered).map(frame => frame.newlyDelivered), level.targets);
    assert.equal(result.frames.filter(frame => frame.kind === 'move').length, result.totalDistance);
    assert.equal(result.warnings.length, 0);
    for (const frame of result.frames) {
      assert.ok(frame.x >= 0 && frame.x <= 6 && frame.y >= 0 && frame.y <= 3);
    }
  });
  test('任务 ' + level.id + '：循环路线与展开路线等价', () => {
    const loop = level.loopSolution;
    const loopResult = engine.simulate(loop.commands, { levelId: level.id, repeat: loop.times });
    const directResult = engine.simulate(level.solution, { levelId: level.id });
    assert.equal(loopResult.status, 'success');
    const semanticFrames = result => result.frames.map(({ sourceIndex, iterations, ...frame }) => frame);
    assert.deepEqual(semanticFrames(loopResult), semanticFrames(directResult));
  });
}

test('右转 180° 与左转 180° 等价', () => {
  const result = engine.simulate([move(3), right(180), move(3), right(180)]);
  assert.equal(result.status, 'success');
  assert.deepEqual(result.final, engine.start);
});
test('连续三次右转 90° 与左转 90° 等价', () => {
  const route = engine.levels[1].solution.flatMap(command => command.type === 'left'
    ? [right(90), right(90), right(90)] : [command]);
  const result = engine.simulate(route, { levelId: 2 });
  assert.equal(result.status, 'success');
  assert.deepEqual(result.delivered, [1, 4, 5]);
});
test('两次左转 45° 等价于左转 90°，随后沿竖直通道行走', () => {
  const result = engine.simulate([left(45), left(45), move(3)]);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.final, { x: 0, y: 3, heading: 90 });
  assert.equal(result.totalDistance, 3);
  assert.equal(result.frames[1].turnDegrees, 45);
  assert.match(result.frames[1].message, /锐角/);
  assert.equal(engine.directionName(45), '偏转 45°');
});
test('两次右转 45° 等价于右转 90°，可以组成合法送餐方案', () => {
  const route = [left(90), move(3), right(45), right(45), move(3), right(45), right(45), move(3), right(45), right(45), move(3), right(180)];
  const result = engine.simulate(route);
  assert.equal(result.status, 'success');
  assert.deepEqual(result.final, engine.start);
});
test('右转 270° 与左转 90° 等价，并说明超过半周', () => {
  const route = engine.levels[1].solution.map(command => command.type === 'left' ? right(270) : command);
  const result = engine.simulate(route, { levelId: 2 });
  assert.equal(result.status, 'success');
  assert.match(result.frames.find(frame => frame.kind === 'turn').message, /超过半周/);
  assert.equal(result.frames.find(frame => frame.kind === 'turn').turnDegrees, 270);
});
test('左转 270° 与右转 90° 等价', () => {
  const result = engine.simulate([left(270)]);
  assert.deepEqual(result.final, engine.simulate([right(90)]).final);
  assert.equal(result.final.heading, 270);
  assert.match(result.frames[1].message, /超过半周/);
  assert.equal(result.frames[1].turnDegrees, 270);
});
test('左转或右转 360° 都原地恢复朝向，按周角反馈', () => {
  for (const turn of [left(360), right(360)]) {
    const result = engine.simulate([turn, ...engine.levels[0].solution]);
    assert.equal(result.status, 'success');
    assert.equal(result.frames[1].heading, 0);
    assert.equal(result.frames[1].x, 0);
    assert.equal(result.frames[1].y, 0);
    assert.equal(result.frames[1].turnDegrees, 360);
    assert.match(result.frames[1].message, /周角/);
  }
});
test('非直角朝向不允许沿方格直行，合法转向帧仍保留', () => {
  for (const [turn, heading] of [[left(45), 45], [right(45), 315], [left(181), 181], [right(359), 1]]) {
    const result = engine.simulate([turn, move(3)]);
    assert.equal(result.status, 'error');
    assert.deepEqual(result.final, { x: 0, y: 0, heading });
    assert.equal(result.errorIndex, 1);
    assert.equal(result.frames.length, 2);
    assert.equal(result.totalDistance, 0);
    assert.match(result.message, /只沿横线或竖线/);
    assert.match(result.message, /请先转到上、下、左、右再直行/);
    assert.match(result.message, new RegExp('偏转 ' + heading + '°'));
  }
});
test('转角分类覆盖所有边界，181～359° 不强加角的名称', () => {
  const cases = [[1, '锐角'], [89, '锐角'], [90, '直角'], [91, '钝角'], [179, '钝角'], [180, '平角'], [181, '超过半周'], [270, '超过半周'], [359, '超过半周'], [360, '周角']];
  for (const [degrees, expected] of cases) {
    assert.equal(engine.angleName(degrees), expected);
    const result = engine.simulate([left(degrees)]);
    assert.notEqual(result.status, 'error');
    assert.ok(result.frames[1].message.includes(expected));
    assert.ok(!result.frames[1].message.includes('undefined'));
  }
});
test('先移动后越界：停在边界，保留已经完成的送餐', () => {
  const result = engine.simulate([move(6), move(1)], { levelId: 3 });
  assert.equal(result.status, 'error');
  assert.deepEqual(result.final, { x: 6, y: 0, heading: 0 });
  assert.deepEqual(result.delivered, [1, 2]);
  assert.equal(result.errorIndex, 1);
  assert.equal(result.totalDistance, 6);
  assert.equal(result.frames.length, 7);
});
test('单条指令中途越界：最后合法位置不变', () => {
  const result = engine.simulate([left(90), move(6)]);
  assert.equal(result.status, 'error');
  assert.deepEqual(result.final, { x: 0, y: 3, heading: 90 });
  assert.equal(result.errorStep, 4);
});
test('向下或向左越界不能穿越边界', () => {
  for (const turn of [right(90), left(180)]) {
    const result = engine.simulate([turn, move(1)]);
    assert.equal(result.status, 'error');
    assert.equal(result.final.x, 0);
    assert.equal(result.final.y, 0);
  }
});
test('错序经过不交付，反馈包含正确下一站', () => {
  const result = engine.simulate([left(90), move(3), right(90), move(3)], { levelId: 2 });
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.delivered, []);
  assert.deepEqual(result.warnings.map(warning => warning.tableId), [5, 4]);
  assert.equal(result.warnings[0].expectedTableId, 1);
  assert.match(result.message, /下一站应是 1/);
});
test('错序后可修正路线，再次到桌正常交付', () => {
  const result = engine.simulate([
    left(90), move(3), right(90), move(3), right(90), move(3),
    left(180), move(3), left(90), move(3), left(90), move(3), left(90)
  ], { levelId: 2 });
  assert.equal(result.status, 'success');
  assert.deepEqual(result.delivered, [1, 4, 5]);
  assert.equal(result.warnings.length, 2);
});
test('已送餐但未返回取餐口', () => {
  const result = engine.simulate([move(3)]);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.delivered, [1]);
  assert.match(result.message, /回到/);
});
test('已回取餐口但没有恢复朝向', () => {
  const result = engine.simulate([move(3), left(180), move(3)]);
  assert.equal(result.status, 'incomplete');
  assert.equal(result.atStart, true);
  assert.equal(result.headingRestored, false);
  assert.match(result.message, /左转 180°/);
});
test('任务末尾偏转任意角仍需恢复出发朝向', () => {
  const result = engine.simulate([...engine.levels[0].solution, left(45)]);
  assert.equal(result.status, 'incomplete');
  assert.equal(result.atStart, true);
  assert.equal(result.headingRestored, false);
  assert.match(result.message, /逆时针偏转 45°/);
  assert.match(result.message, /右转 45°恢复出发朝向/);
});
test('成功后追加越界指令仍判失败', () => {
  const result = engine.simulate([...engine.levels[0].solution, right(90), move(1)]);
  assert.equal(result.status, 'error');
});
test('空指令给出可操作提示', () => {
  const result = engine.simulate([]);
  assert.equal(result.status, 'incomplete');
  assert.match(result.message, /先添加/);
});
test('非法输入返回 error；expand 明确拒绝', () => {
  const invalidCommands = [
    null, {}, 'move', [null], [undefined], new Array(1), [move(0)], [move(7)],
    [move(-1)], [move(1.5)], [move('3')], [move(NaN)], [move(Infinity)],
    [left(0)], [right(361)], [left(-45)], [left(45.5)], [right(NaN)],
    [left(Infinity)], [left('90')], [{ type: 'fly', value: 3 }]
  ];
  for (const commands of invalidCommands) {
    assert.throws(() => engine.expand(commands));
    const result = engine.simulate(commands);
    assert.equal(result.status, 'error');
    assert.deepEqual(result.final, engine.start);
    assert.equal(result.frames.length, 1);
  }
  for (const repeat of [0, 9, -1, 1.5, '2', null, NaN, Infinity]) {
    assert.throws(() => engine.expand([move(1)], repeat));
    assert.equal(engine.simulate([move(1)], { repeat }).status, 'error');
  }
  for (const options of [null, 1, [], { levelId: 0 }, { levelId: '1' }, { levelId: null }]) {
    assert.equal(engine.simulate([], options).status, 'error');
  }
});
test('操作总量有限制，展开结果不引用原指令', () => {
  const command = move(1);
  const expanded = engine.expand([command], 2);
  expanded[0].value = 5;
  assert.equal(command.value, 1);
  assert.equal(expanded[1].value, 1);
  assert.throws(() => engine.expand(Array(17).fill(left(90)), 8), /最多/);
  assert.equal(engine.expand(Array(16).fill(left(90)), 8).length, 128);
});
test('frame 的交付记录为独立快照', () => {
  const result = engine.simulate(engine.levels[2].solution, { levelId: 3 });
  assert.deepEqual(result.frames[0].delivered, []);
  const first = result.frames.find(frame => frame.newlyDelivered === 1);
  assert.deepEqual(first.delivered, [1]);
  result.delivered.push(99);
  assert.deepEqual(first.delivered, [1]);
});

test('显式循环只重复开始与结束之间的动作，循环外各执行一次', () => {
  const commands = [left(360), repeat('route', 2), move(3), left(180), end('route'), right(360)];
  const compiled = engine.compile(commands);
  assert.deepEqual(engine.expand(commands), [left(360), move(3), left(180), move(3), left(180), right(360)]);
  assert.deepEqual(compiled.expanded.map(command => command.sourceIndex), [0, 2, 3, 2, 3, 5]);
  assert.deepEqual(compiled.expanded.map(command => command.iterations), [
    [], [{ id: 'route', iteration: 1, times: 2 }], [{ id: 'route', iteration: 1, times: 2 }],
    [{ id: 'route', iteration: 2, times: 2 }], [{ id: 'route', iteration: 2, times: 2 }], []
  ]);
  assert.equal(engine.simulate(commands).status, 'success');
  assert.equal(compiled.ast.length, 3);
  assert.deepEqual(compiled.ast[1], {
    type: 'repeat', id: 'route', value: 2, sourceIndex: 1, endSourceIndex: 4,
    body: [{ type: 'move', value: 3, sourceIndex: 2 }, { type: 'left', value: 180, sourceIndex: 3 }]
  });
});

for (const level of engine.levels) {
  test('任务 ' + level.id + '：显式开始和结束的循环通关', () => {
    const loop = level.loopSolution;
    const commands = [repeat('route', loop.times), ...loop.commands, end('route')];
    const result = engine.simulate(commands, { levelId: level.id });
    assert.equal(result.status, 'success');
    assert.deepEqual(result.delivered, level.targets);
    assert.deepEqual(result.final, engine.start);
    assert.equal(result.frames[0].sourceIndex, -1);
    assert.deepEqual(result.frames[0].iterations, []);
    assert.equal(result.frames.at(-1).sourceIndex, loop.commands.length);
    assert.deepEqual(result.frames.at(-1).iterations, [{ id: 'route', iteration: loop.times, times: loop.times }]);
  });
}

test('嵌套循环按外层再内层执行，迭代索引准确', () => {
  const commands = [repeat('outer', 2), left(360), repeat('inner', 3), right(360), end('inner'), end('outer')];
  const result = engine.compile(commands);
  assert.equal(result.expanded.length, 8);
  assert.deepEqual(result.expanded.map(command => command.sourceIndex), [1, 3, 3, 3, 1, 3, 3, 3]);
  assert.deepEqual(result.expanded[7].iterations, [
    { id: 'outer', iteration: 2, times: 2 }, { id: 'inner', iteration: 3, times: 3 }
  ]);
  assert.equal(result.ast[0].body[1].type, 'repeat');
  assert.equal(result.ast[0].body[1].endSourceIndex, 4);
  const simulation = engine.simulate(commands);
  assert.equal(simulation.turns, 8);
  assert.equal(simulation.frames.at(-1).commandIndex, 7);
  assert.equal(simulation.frames.at(-1).sourceIndex, 3);
  assert.deepEqual(simulation.frames.at(-1).iterations, result.expanded[7].iterations);
});

test('多个顺序循环互不包含，并允许中间与末尾普通指令', () => {
  const commands = [repeat('first', 2), left(90), end('first'), move(1), repeat('second', 3), right(90), end('second'), move(2)];
  const compiled = engine.compile(commands);
  assert.deepEqual(engine.expand(commands), [left(90), left(90), move(1), right(90), right(90), right(90), move(2)]);
  assert.deepEqual(compiled.expanded[2].iterations, []);
  assert.deepEqual(compiled.expanded[3].iterations, [{ id: 'second', iteration: 1, times: 3 }]);
  assert.deepEqual(compiled.expanded[6].iterations, []);
  assert.deepEqual(compiled.ast.map(node => node.type), ['repeat', 'move', 'repeat', 'move']);
});

test('移动开始边界或结束边界会改变真正重复的范围', () => {
  const original = [left(90), repeat('scope', 2), move(1), right(90), end('scope'), left(180)];
  const startMoved = [repeat('scope', 2), left(90), move(1), right(90), end('scope'), left(180)];
  const endMoved = [left(90), repeat('scope', 2), move(1), end('scope'), right(90), left(180)];
  assert.deepEqual(engine.expand(original), [left(90), move(1), right(90), move(1), right(90), left(180)]);
  assert.deepEqual(engine.expand(startMoved), [left(90), move(1), right(90), left(90), move(1), right(90), left(180)]);
  assert.deepEqual(engine.expand(endMoved), [left(90), move(1), move(1), right(90), left(180)]);
  assert.notEqual(engine.toPython(original), engine.toPython(startMoved));
  assert.notEqual(engine.toPython(original), engine.toPython(endMoved));
});

test('没有匹配的开始、结束、交叉、空循环均带明确积木位置', () => {
  const invalid = [
    { commands: [end('alone')], index: 0, message: /没有对应的循环开始/ },
    { commands: [move(1), repeat('open', 2), left(90)], index: 1, message: /缺少对应的循环结束/ },
    { commands: [repeat('a', 2), repeat('b', 2), move(1), end('a'), end('b')], index: 3, message: /交叉/ },
    { commands: [repeat('a', 2), move(1), end('b')], index: 2, message: /开始和结束不匹配/ },
    { commands: [repeat('empty', 2), end('empty')], index: 1, message: /空循环/ },
    { commands: [repeat('outer', 2), repeat('empty', 1), end('empty'), end('outer')], index: 2, message: /空循环/ },
    { commands: [repeat('a', 2), move(1), end('a'), end('a')], index: 3, message: /没有对应的循环开始/ }
  ];
  for (const { commands, index, message } of invalid) {
    assert.throws(() => engine.compile(commands), error => {
      assert.match(error.message, message);
      assert.match(error.message, new RegExp('第 ' + (index + 1) + ' 块积木'));
      assert.equal(error.sourceIndex, index);
      return true;
    });
    assert.throws(() => engine.toPython(commands), message);
    const result = engine.simulate(commands);
    assert.equal(result.status, 'error');
    assert.match(result.message, message);
    assert.equal(result.errorSourceIndex, index);
    assert.equal(result.frames.length, 1);
    assert.deepEqual(result.final, engine.start);
  }
});

test('循环标记必须有效且每个开始块唯一', () => {
  for (const id of ['', ' ', 1, null, undefined]) {
    assert.throws(() => engine.compile([repeat(id, 2), move(1), end(id)]), /配对标记/);
    assert.throws(() => engine.compile([end(id)]), /配对标记/);
  }
  assert.throws(() => engine.compile([repeat('same', 2), move(1), end('same'), repeat('same', 2), move(1), end('same')]), /标记重复/);
  assert.throws(() => engine.compile([repeat('same', 2), repeat('same', 2), move(1), end('same'), end('same')]), /标记重复/);
});

test('循环次数限制为 1～8 的整数，1 次和 8 次有效', () => {
  for (const value of [0, 9, -1, 1.5, NaN, Infinity, '2', null, undefined]) {
    assert.throws(() => engine.compile([repeat('r', value), left(90), end('r')]), /1～8/);
  }
  for (const value of [1, 8]) {
    assert.equal(engine.compile([repeat('r', value), left(90), end('r')]).expanded.length, value);
  }
});

test('允许四层嵌套，第五层给出对应开始块位置', () => {
  const nested = depth => [
    ...Array.from({ length: depth }, (_, index) => repeat('r' + index, 1)),
    left(360),
    ...Array.from({ length: depth }, (_, index) => end('r' + (depth - index - 1)))
  ];
  const compiled = engine.compile(nested(4));
  assert.equal(compiled.expanded.length, 1);
  assert.equal(compiled.expanded[0].iterations.length, 4);
  assert.throws(() => engine.compile(nested(5)), /第 5 块积木：循环最多嵌套 4 层/);
});

test('限制按真正展开动作数计算，128 条可执行，129 条拒绝', () => {
  const exact = [repeat('outer', 8), repeat('inner', 8), left(90), right(90), end('inner'), end('outer')];
  assert.equal(engine.compile(exact).expanded.length, 128);
  assert.equal(engine.simulate(exact).turns, 128);
  assert.throws(() => engine.compile([...exact, left(90)]), /最多执行 128/);
  assert.throws(() => engine.compile([repeat('outer', 8), repeat('inner', 8), left(90), right(90), left(90), end('inner'), end('outer')]), /最多执行 128/);
  assert.equal(engine.compile([repeat('r', 8), left(90), right(90), end('r')], { repeat: 8 }).expanded.length, 128);
  assert.throws(() => engine.compile(exact, { repeat: 2 }), /最多执行 128/);
});

test('帧上的 sourceIndex 对应原积木，commandIndex 对应展开动作', () => {
  const commands = [repeat('route', 2), move(3), left(180), end('route')];
  const result = engine.simulate(commands);
  assert.deepEqual(result.frames.map(frame => frame.sourceIndex), [-1, 1, 1, 1, 2, 1, 1, 1, 2]);
  assert.deepEqual(result.frames.map(frame => frame.commandIndex), [-1, 0, 0, 0, 1, 2, 2, 2, 3]);
  assert.deepEqual(result.frames.slice(1).map(frame => frame.iterations[0].iteration), [1, 1, 1, 1, 2, 2, 2, 2]);
  const error = engine.simulate([repeat('r', 2), right(90), move(1), end('r')]);
  assert.equal(error.status, 'error');
  assert.equal(error.errorIndex, 1);
  assert.equal(error.errorSourceIndex, 2);
});

test('编译与帧的迭代记录相互独立，不修改原积木', () => {
  const commands = [repeat('r', 2), left(360), end('r')];
  const before = JSON.stringify(commands);
  const compiled = engine.compile(commands);
  compiled.expanded[0].iterations[0].iteration = 99;
  compiled.ast[0].body[0].value = 45;
  assert.equal(compiled.expanded[1].iterations[0].iteration, 2);
  assert.equal(compiled.expanded[0].value, 360);
  const result = engine.simulate(commands);
  result.frames[1].iterations[0].iteration = 99;
  assert.equal(result.frames[2].iterations[0].iteration, 2);
  assert.equal(JSON.stringify(commands), before);
});

test('Python 预览使用真正的作用范围、四空格缩进和独立循环变量', () => {
  const commands = [move(3), repeat('outer', 2), left(90), repeat('inner', 3), right(45), end('inner'), move(1), end('outer'), repeat('last', 4), left(90), end('last'), right(180)];
  assert.equal(engine.toPython(commands), [
    'move(3)',
    'for i1 in range(2):',
    '    turn_left(90)',
    '    for i2 in range(3):',
    '        turn_right(45)',
    '    move(1)',
    'for i3 in range(4):',
    '    turn_left(90)',
    'turn_right(180)'
  ].join('\n'));
  assert.equal(engine.toPython([]), '');
  assert.equal(engine.toPython([move(3), left(90), right(180)]), 'move(3)\nturn_left(90)\nturn_right(180)');
});

test('兼容旧 expand 和全体 repeat 参数，编译结果保持原始位置', () => {
  assert.deepEqual(engine.expand([move(1), left(90)], 2), [move(1), left(90), move(1), left(90)]);
  const compiled = engine.compile([move(1), left(90)], { repeat: 2 });
  assert.deepEqual(compiled.expanded.map(command => command.sourceIndex), [0, 1, 0, 1]);
  assert.ok(compiled.expanded.every(command => command.iterations.length === 0));
  for (const options of [null, [], 1, '2']) assert.throws(() => engine.compile([], options), /设置/);
});
console.log('\n' + passed + ' tests passed.');
