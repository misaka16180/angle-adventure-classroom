/* Blockly connections are the program: only the chain under robot_start runs.
 * This adapter has no UI dependency and can also be tested in Node. */
(function (root, factory) {
  'use strict';
  const adapter = factory();
  if (typeof module === 'object' && module.exports) module.exports = adapter;
  if (root) root.BlockAdapter = adapter;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const MAX_NESTING = 4;
  const MAX_ACTIONS = 40;
  const TYPES = Object.freeze(Object.assign(Object.create(null), {robot_move: 'move', robot_left: 'left', robot_right: 'right'}));
  const ROBOT_TYPES = Object.freeze(Object.assign(Object.create(null), {move: 'robot_move', left: 'robot_left', right: 'robot_right'}));

  function fail(message, blockId, sourceIndex, ErrorType = RangeError) {
    const error = new ErrorType(message);
    if (blockId !== undefined) error.blockId = blockId;
    if (sourceIndex !== undefined) error.sourceIndex = sourceIndex;
    throw error;
  }

  function valueFor(type, value, blockId, sourceIndex) {
    // Blockly's numeric fields can return strings; imported programs must still
    // use numbers to avoid silently accepting malformed saved programs.
    const maximum = type === 'repeat' ? 8 : type === 'move' ? 6 : 360;
    if (!Number.isInteger(value) || value < 1 || value > maximum) {
      const description = type === 'repeat' ? '循环次数' : type === 'move' ? '直行格数' : '转向角度';
      fail(description + '应是 1～' + maximum + ' 的整数。', blockId, sourceIndex);
    }
    return value;
  }

  function workspaceToProgram(workspace) {
    if (!workspace || typeof workspace.getAllBlocks !== 'function') {
      throw new TypeError('需要一个有效的积木工作区。');
    }
    const all = workspace.getAllBlocks(false);
    const starts = all.filter(block => block.type === 'robot_start');
    if (starts.length !== 1) {
      fail(starts.length ? '只能有一个“程序开始”积木。' : '请保留一个“程序开始”积木，再把指令接在下面。', starts[1] && starts[1].id);
    }
    const commands = [];
    const sourceBlockIds = [];
    const visited = new Set([starts[0]]);
    let actionCount = 0;

    function append(command, block) {
      commands.push(command);
      sourceBlockIds.push(block.id);
    }

    function visit(block, depth) {
      while (block) {
        if (visited.has(block)) fail('积木连接成了闭环，请重新连接这组积木。', block.id, commands.length);
        visited.add(block);
        if (block.type === 'robot_repeat') {
          if (depth >= MAX_NESTING) fail('循环最多嵌套 4 层，请把这组循环移到外面。', block.id, commands.length);
          if (typeof block.id !== 'string' || !block.id) fail('循环积木缺少有效标识。', block.id, commands.length);
          const value = valueFor('repeat', Number(block.getFieldValue('TIMES')), block.id, commands.length);
          append({type: 'repeat', value, id: block.id}, block);
          visit(block.getInputTargetBlock('DO'), depth + 1);
          // The end marker is a virtual token used by RobotEngine. Keep the
          // loop block id at the same flat index so playback can highlight
          // the visible C-shaped container for both its opening and closing
          // token.
          append({type: 'endRepeat', id: block.id}, block);
        } else {
          const type = TYPES[block.type];
          if (!type) fail('这块积木不能用于机器人送餐程序。', block.id, commands.length, TypeError);
          actionCount += 1;
          if (actionCount > MAX_ACTIONS) fail('一个程序最多连接 40 块直行或转向积木，请用循环简化。', block.id, commands.length);
          const value = valueFor(type, Number(block.getFieldValue('VALUE')), block.id, commands.length);
          append({type, value, blockId: block.id}, block);
        }
        block = block.getNextBlock();
      }
    }
    visit(starts[0].getNextBlock(), 0);
    return {commands, sourceBlockIds, disconnectedCount: all.filter(block => !visited.has(block)).length};
  }

  function parseProgram(commands) {
    if (!Array.isArray(commands)) throw new TypeError('指令必须放在一个列表中。');
    const nodes = [];
    const stack = [];
    const usedIds = new Set();
    let actionCount = 0;
    commands.forEach((command, index) => {
      if (!command || typeof command !== 'object' || Array.isArray(command)) {
        fail('第 ' + (index + 1) + ' 条指令格式不正确。', undefined, index, TypeError);
      }
      const body = stack.length ? stack[stack.length - 1].body : nodes;
      if (command.type === 'repeat') {
        if (typeof command.id !== 'string' || !command.id.trim() || usedIds.has(command.id)) {
          fail('每个循环都需要一个不同的有效标识。', command.id, index);
        }
        if (stack.length >= MAX_NESTING) fail('循环最多嵌套 4 层。', command.id, index);
        valueFor('repeat', command.value, command.id, index);
        const node = {type: 'repeat', value: command.value, id: command.id, sourceIndex: index, body: []};
        body.push(node);
        stack.push(node);
        usedIds.add(command.id);
      } else if (command.type === 'endRepeat') {
        if (!stack.length || stack[stack.length - 1].id !== command.id) {
          fail('循环开始与结束必须正确配对，不能交叉。', command.id, index);
        }
        stack.pop();
      } else {
        if (!ROBOT_TYPES[command.type]) fail('不能识别第 ' + (index + 1) + ' 条指令。', command.blockId, index, TypeError);
        valueFor(command.type, command.value, command.blockId, index);
        actionCount += 1;
        if (actionCount > MAX_ACTIONS) fail('一个程序最多连接 40 块直行或转向积木。', command.blockId, index);
        body.push({type: command.type, value: command.value});
      }
    });
    if (stack.length) {
      const open = stack[stack.length - 1];
      fail('循环缺少对应的结束位置。', open.id, open.sourceIndex);
    }
    return nodes;
  }

  function buildProgram(workspace, commands) {
    // Validate before clearing: a bad import must not destroy the student's work.
    const tree = parseProgram(commands);
    if (!workspace || typeof workspace.newBlock !== 'function' || typeof workspace.clear !== 'function') {
      throw new TypeError('需要一个有效的积木工作区。');
    }
    workspace.clear();
    function create(type) {
      const block = workspace.newBlock(type);
      if (typeof block.initSvg === 'function') block.initSvg();
      return block;
    }
    function render(block) {
      if (typeof block.render === 'function') block.render();
    }
    function connectNodes(nodes, previousConnection) {
      for (const node of nodes) {
        const block = create(node.type === 'repeat' ? 'robot_repeat' : ROBOT_TYPES[node.type]);
        block.setFieldValue(String(node.value), node.type === 'repeat' ? 'TIMES' : 'VALUE');
        previousConnection.connect(block.previousConnection);
        if (node.type === 'repeat') connectNodes(node.body, block.getInput('DO').connection);
        render(block);
        previousConnection = block.nextConnection;
      }
    }
    const start = create('robot_start');
    connectNodes(tree, start.nextConnection);
    render(start);
    return start;
  }

  return Object.freeze({workspaceToProgram, buildProgram, parseProgram, MAX_NESTING, MAX_ACTIONS});
});
