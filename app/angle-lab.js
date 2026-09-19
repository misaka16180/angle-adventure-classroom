(function () {
  'use strict';

  window.mountAngleLab = function mountAngleLab(container) {
    const root = document.createElement('section');
    root.className = 'angle-lab';
    root.setAttribute('aria-label', '角的度量互动实验室');
    root.innerHTML = `
      <style>
        .angle-lab{--al-ink:#163c34;--al-green:#166d57;--al-paper:#f5f3ec;--al-gold:#f1c75b;--al-orange:#e59250;font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:var(--al-ink);display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,1fr);gap:20px;width:100%;box-sizing:border-box}
        .angle-lab *{box-sizing:border-box}.angle-lab button,.angle-lab input{font:inherit}.angle-lab button{cursor:pointer;min-height:48px;border:1.5px solid #d6dfd7;border-radius:12px;color:var(--al-ink);background:white;font-weight:700;padding:10px 15px;touch-action:manipulation;transition:background .15s,transform .15s}.angle-lab button:hover{background:#edf4ed}.angle-lab button:active{transform:scale(.97)}.angle-lab button:focus-visible,.angle-lab input:focus-visible,.angle-lab [tabindex]:focus-visible{outline:4px solid var(--al-gold);outline-offset:4px}.angle-lab button[aria-pressed="true"]{background:var(--al-green);border-color:var(--al-green);color:white}.angle-lab .al-stage{display:flex;flex-direction:column;background:white;border:1px solid #e0e5dc;border-radius:24px;overflow:hidden;min-width:0}.angle-lab .al-stage-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px 0}.angle-lab .al-kicker{font-size:13px;font-weight:800;letter-spacing:.12em;color:#4f7368}.angle-lab h2{font-size:25px;line-height:1.35;margin:5px 0 0}.angle-lab .al-reading{text-align:center;background:#f8f0d2;border-radius:16px;padding:10px 18px;min-width:116px}.angle-lab .al-reading strong{display:block;font-size:32px;line-height:1.15;font-variant-numeric:tabular-nums}.angle-lab .al-reading span{font-size:14px;display:block;margin-top:4px;font-weight:700}.angle-lab .al-canvas{width:100%;display:block;overflow:visible;touch-action:none;user-select:none;min-height:280px;max-height:590px;aspect-ratio:900/600}.angle-lab .al-canvas text{font-family:"Microsoft YaHei","PingFang SC",sans-serif;pointer-events:none}.angle-lab .al-svg-wrap{position:relative;flex:1;display:flex;align-items:center}.angle-lab .al-hint{margin:0 24px 14px;padding:12px 16px;border-radius:12px;background:var(--al-paper);font-size:16px;line-height:1.6}.angle-lab .al-hint b{color:var(--al-green)}.angle-lab .al-legend{display:flex;flex-wrap:wrap;gap:10px 22px;padding:0 26px 19px;font-size:14px;font-weight:700}.angle-lab .al-legend span{display:flex;align-items:center;gap:7px}.angle-lab .al-dot{width:11px;height:11px;border-radius:100%;background:var(--al-green);display:inline-block}.angle-lab .al-dot.orange{background:#a65516}.angle-lab .al-panel{display:flex;flex-direction:column;gap:15px;min-width:0}.angle-lab .al-card{background:white;border:1px solid #e0e5dc;border-radius:20px;padding:20px}.angle-lab h3{font-size:20px;margin:0 0 14px}.angle-lab .al-buttons{display:flex;flex-wrap:wrap;gap:8px}.angle-lab .al-buttons button{flex:1;white-space:nowrap}.angle-lab .al-main-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.angle-lab .al-control-label{display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:700;margin-top:17px;gap:10px}.angle-lab .al-adjust{display:grid;grid-template-columns:49px minmax(0,1fr) 49px;gap:10px;align-items:center;margin:9px 0 13px}.angle-lab .al-adjust button{padding:4px;font-size:24px}.angle-lab input[type="range"]{width:100%;accent-color:var(--al-green);height:34px;cursor:pointer;touch-action:none}.angle-lab .al-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.angle-lab .al-presets button{padding:8px 4px;min-height:43px;font-size:15px}.angle-lab .al-steps{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px}.angle-lab .al-steps li{display:flex;gap:11px;align-items:flex-start;font-size:17px;line-height:1.55}.angle-lab .al-steps i{font-style:normal;border-radius:9px;background:#e6efe6;color:var(--al-green);width:30px;height:30px;flex:0 0 30px;text-align:center;line-height:30px;font-size:15px;font-weight:800}.angle-lab .al-steps strong{font-weight:800}.angle-lab .al-insight{border-left:4px solid var(--al-gold);margin:16px 0 0;padding:0 0 0 12px;font-size:15px;line-height:1.65;color:#446357}.angle-lab .al-small{font-size:13px;line-height:1.65;color:#587369;margin:10px 0 0}.angle-lab .al-live{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.angle-lab .al-drag-handle{cursor:grab;touch-action:none}.angle-lab .al-drag-handle:active{cursor:grabbing}.angle-lab .al-canvas .al-ray{pointer-events:none}
        .angle-lab .al-stage>.al-presets{grid-template-columns:repeat(7,1fr);margin:0 24px 14px}.angle-lab .al-stage>.al-presets button{min-height:46px;font-size:17px}
        @media(min-width:1600px){.angle-lab{gap:26px}.angle-lab h2{font-size:31px}.angle-lab h3{font-size:24px}.angle-lab .al-card{padding:25px}.angle-lab .al-steps li{font-size:20px}.angle-lab button{min-height:54px;font-size:18px}.angle-lab .al-canvas{max-height:710px}.angle-lab .al-hint{font-size:20px}.angle-lab .al-reading strong{font-size:40px}}
        @media(max-width:1050px){.angle-lab{grid-template-columns:minmax(0,1.5fr) minmax(270px,1fr);gap:12px}.angle-lab .al-card{padding:16px}.angle-lab .al-stage-head{padding:17px 17px 0}.angle-lab h2{font-size:21px}.angle-lab .al-reading{padding:8px 12px;min-width:98px}.angle-lab .al-reading strong{font-size:28px}.angle-lab .al-hint{margin:0 16px 12px;font-size:15px}.angle-lab .al-steps li{font-size:16px}.angle-lab .al-legend{font-size:12px;padding:0 17px 16px}}
        @media(max-height:900px) and (min-width:900px){.angle-lab{gap:16px}.angle-lab .al-card{padding:15px}.angle-lab h3{font-size:18px;margin-bottom:10px}.angle-lab button{min-height:44px;padding:8px 10px}.angle-lab .al-control-label{margin-top:11px}.angle-lab .al-adjust{margin:7px 0 0}.angle-lab .al-main-buttons{margin-top:8px}.angle-lab .al-steps{gap:8px}.angle-lab .al-step-detail{display:none}.angle-lab .al-insight{margin-top:12px;font-size:14px;line-height:1.55}.angle-lab .al-small{font-size:12px;line-height:1.55;margin-top:8px}.angle-lab .al-canvas{max-height:450px}.angle-lab .al-stage-head{padding:16px 20px 0}.angle-lab h2{font-size:22px}.angle-lab .al-stage>.al-presets{margin:0 20px 10px}.angle-lab .al-hint{margin:0 20px 10px;font-size:15px;padding:10px 14px}.angle-lab .al-legend{padding-bottom:14px}}
        @media(max-width:730px){.angle-lab{grid-template-columns:1fr}.angle-lab .al-panel{display:grid;grid-template-columns:1fr}.angle-lab .al-canvas{min-height:220px}.angle-lab .al-stage-head{padding:18px 18px 0}.angle-lab h2{font-size:23px}.angle-lab .al-legend{font-size:13px}.angle-lab .al-reading{min-width:106px}.angle-lab .al-card{padding:19px}.angle-lab .al-stage>.al-presets{grid-template-columns:repeat(4,1fr);margin:0 16px 14px}}
        .angle-lab .al-canvas{aspect-ratio:900/492;max-height:500px}
        @media(min-width:1600px){.angle-lab .al-card{padding:20px}.angle-lab h3{font-size:22px;margin-bottom:11px}.angle-lab button{min-height:48px}.angle-lab .al-steps li{font-size:18px;line-height:1.5}.angle-lab .al-steps{gap:12px}.angle-lab .al-control-label{margin-top:12px}.angle-lab .al-adjust{margin:7px 0 0}.angle-lab .al-stage-head{padding-top:18px}.angle-lab h2{font-size:26px}.angle-lab .al-reading strong{font-size:34px}.angle-lab .al-hint{font-size:17px}.angle-lab .al-canvas{max-height:500px}}
        @media(max-height:900px) and (min-width:900px){.angle-lab .al-canvas{max-height:390px}.angle-lab .al-stage-head{padding-top:13px}.angle-lab h2{font-size:21px}}
        .angle-lab button.al-reading{border:2px solid #e9d99c;background:#f8f0d2;cursor:pointer}.angle-lab .al-reading em{display:block;font-style:normal;font-size:11px;line-height:1.2;letter-spacing:.03em;margin-top:4px;color:#6b632f}
        .angle-lab dialog.al-numpad{width:min(390px,calc(100vw - 32px));max-height:calc(100dvh - 24px);overflow:auto;position:fixed;margin:auto;border:0;border-radius:24px;background:#fff;padding:22px;box-shadow:0 18px 60px #163c344d;color:var(--al-ink)}.angle-lab dialog.al-numpad::backdrop{background:#163c3477}.angle-lab .al-numpad h3{font-size:22px;margin:0 0 13px}.angle-lab .al-numpad-display{min-height:58px;display:flex;align-items:center;justify-content:center;border:2px solid #dce4d9;border-radius:14px;background:#f8faf3;font-size:34px;font-weight:800;letter-spacing:.08em;font-variant-numeric:tabular-nums}.angle-lab .al-numpad-error{min-height:23px;color:#a44818;text-align:center;font-size:14px;font-weight:700;margin:7px 0 2px}.angle-lab .al-numpad-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.angle-lab .al-numpad-keys button{min-height:56px;font-size:24px;padding:6px}.angle-lab .al-numpad-keys button.al-key-action{font-size:16px;background:#f5f3ec}.angle-lab .al-numpad-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.angle-lab .al-numpad-actions button{min-height:56px;font-size:18px}.angle-lab .al-numpad-actions .al-confirm{background:var(--al-green);color:white;border-color:var(--al-green)}.angle-lab .al-numpad-actions .al-confirm:disabled{background:#e5ebe3;color:#708174;border-color:#d5ded1;cursor:default}
        .angle-lab button{-webkit-tap-highlight-color:transparent;user-select:none}.angle-lab .al-numpad-error{color:#587369}.angle-lab .al-numpad-error[data-invalid="true"]{color:#a44818}
        @media(min-width:1600px){.angle-lab .al-canvas{max-height:465px}}
      </style>
      <div class="al-stage">
        <div class="al-stage-head"><div><div class="al-kicker">动手量一量</div><h2>转动一条边，发现角的秘密</h2></div><button type="button" class="al-reading" data-al="open-numpad" aria-label="点此输入角度"><strong data-al="degree">60°</strong><span data-al="kind">锐角</span><em>点此输入</em></button></div>
        <div class="al-svg-wrap"><svg class="al-canvas" viewBox="0 58 900 492" role="img" aria-label="可拖动活动边的双圈量角器" data-al="svg"></svg></div>
        <p class="al-hint" data-al="hint">拖动<b>橙色圆点</b>改变角的大小。沿着基准边的 <b>0°</b> 开始读数。</p>
        <div class="al-legend"><span><i class="al-dot"></i>内圈：右边从 0° 起</span><span><i class="al-dot orange"></i>外圈：左边从 0° 起</span></div>
      </div>
      <div class="al-panel">
        <div class="al-card"><h3>我的量角工具</h3><div class="al-buttons" role="group" aria-label="选择基准边方向"><button type="button" data-al="right" aria-pressed="true">基准边向右</button><button type="button" data-al="left" aria-pressed="false">基准边向左</button></div><div class="al-main-buttons"><button type="button" data-al="protractor" aria-pressed="true">隐藏量角器</button><button type="button" data-al="answer" aria-pressed="false">隐藏度数</button><button type="button" data-al="extend" aria-pressed="false">伸长两条边</button><button type="button" data-al="reset">重新观察</button></div><div class="al-control-label"><label for="al-range-unique">调整角度</label><span data-al="adjust-label">每次 1°</span></div><div class="al-adjust"><button type="button" data-al="minus" aria-label="角度减小一度">−</button><input type="range" min="1" max="180" value="60" step="1" data-al="range" aria-label="角度，1 至 180 度"><button type="button" data-al="plus" aria-label="角度增大一度">＋</button></div><div class="al-presets" role="group" aria-label="常见角度"><button type="button" data-angle="30">30°</button><button type="button" data-angle="45">45°</button><button type="button" data-angle="60">60°</button><button type="button" data-angle="90">90°</button><button type="button" data-angle="120">120°</button><button type="button" data-angle="150">150°</button><button type="button" data-angle="180">180°</button></div></div>
        <div class="al-card"><h3>量角三步走</h3><ol class="al-steps"><li><i>1</i><div><strong>中心对顶点</strong><span class="al-step-detail"><br>量角器的中心与角的顶点重合。</span></div></li><li><i>2</i><div><strong>0° 刻度线对一条边</strong><span class="al-step-detail"><br>让一条边与 0° 刻度线重合。</span></div></li><li><i>3</i><div><strong>从 0° 起读另一条边</strong><span class="al-step-detail"><br><span data-al="read-guide">从右边内圈的 0° 起，读内圈刻度。</span></span></div></li></ol><p class="al-insight" data-al="insight">角的大小与两条边张开的大小有关，与边画得长短无关。</p><p class="al-small">锐角 &lt; 90° · 直角 = 90°<br>90° &lt; 钝角 &lt; 180° · 平角 = 180°<br>绕顶点转一整圈：周角 = 360°</p></div>
      </div><div class="al-live" aria-live="polite" data-al="live"></div>
      <dialog class="al-numpad" data-al="numpad" aria-label="触屏角度输入"><h3>输入角度 <small>1°～180°</small></h3><output class="al-numpad-display" data-al="numpad-display" aria-live="polite">—</output><p class="al-numpad-error" data-al="numpad-error">点下面的数字</p><div class="al-numpad-keys"><button type="button" data-key="1">1</button><button type="button" data-key="2">2</button><button type="button" data-key="3">3</button><button type="button" data-key="4">4</button><button type="button" data-key="5">5</button><button type="button" data-key="6">6</button><button type="button" data-key="7">7</button><button type="button" data-key="8">8</button><button type="button" data-key="9">9</button><button type="button" data-key="clear" class="al-key-action">清空</button><button type="button" data-key="0">0</button><button type="button" data-key="delete" class="al-key-action">⌫ 删除</button></div><div class="al-numpad-actions"><button type="button" data-al="numpad-cancel">取消</button><button type="button" class="al-confirm" data-al="numpad-confirm">确认</button></div></dialog>`;
    container.appendChild(root);
    const el = name => root.querySelector(`[data-al="${name}"]`);
    root.querySelector('.al-stage').insertBefore(root.querySelector('.al-presets'), el('hint'));
    const svg = el('svg');
    const NS = 'http://www.w3.org/2000/svg';
    const unique = 'al-' + Math.random().toString(36).slice(2, 9);
    el('range').id = unique + '-range';
    root.querySelector('label').htmlFor = el('range').id;
    const listeners = [];
    const on = (target, name, handler, options) => {
      target.addEventListener(name, handler, options);
      listeners.push(() => target.removeEventListener(name, handler, options));
    };
    const add = (name, attrs, parent = svg, text) => {
      const node = document.createElementNS(NS, name);
      Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
      if (text !== undefined) node.textContent = text;
      parent.appendChild(node);
      return node;
    };
    const cx = 450, cy = 468, radius = 334;
    const point = (angle, r) => ({ x: cx + Math.cos(angle * Math.PI / 180) * r, y: cy - Math.sin(angle * Math.PI / 180) * r });
    const pathArc = (r, from, to) => {
      const a = point(from, r), b = point(to, r);
      return `M ${a.x} ${a.y} A ${r} ${r} 0 0 ${to > from ? 0 : 1} ${b.x} ${b.y}`;
    };
    const defs = add('defs');
    [['fixed', '#166d57'], ['moving', '#c77535']].forEach(([key, color]) => {
      const marker = add('marker', { id: unique + '-' + key, markerWidth: 9, markerHeight: 9, refX: 7, refY: 4.5, orient: 'auto', markerUnits: 'strokeWidth' }, defs);
      add('path', { d: 'M 0 0 L 9 4.5 L 0 9 z', fill: color }, marker);
    });
    const protractor = add('g', { 'data-part': 'protractor' });
    add('path', { d: `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy} L ${cx - radius} ${cy} Z`, fill: '#f8faf3', stroke: '#b7c9bb', 'stroke-width': 2 }, protractor);
    [233, 283].forEach(r => add('path', { d: pathArc(r, 0, 180), fill: 'none', stroke: '#dce4d9', 'stroke-width': 1 }, protractor));
    for (let d = 0; d <= 180; d += 1) {
      const a = point(d, radius), b = point(d, radius - (d % 10 === 0 ? 24 : d % 5 === 0 ? 16 : 8));
      add('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: d % 10 === 0 ? '#526b60' : '#aebdaf', 'stroke-width': d % 10 === 0 ? 2 : 1 }, protractor);
      if (d % 10 === 0) {
        const outer = point(d, 297), inner = point(d, 258);
        add('text', { x: outer.x, y: outer.y - (d === 0 || d === 180 ? 10 : 0), fill: '#a65516', 'font-size': 17, 'font-weight': d % 30 === 0 ? 800 : 600, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, protractor, 180 - d);
        add('text', { x: inner.x, y: inner.y - (d === 0 || d === 180 ? 10 : 0), fill: '#166d57', 'font-size': 17, 'font-weight': d % 30 === 0 ? 800 : 600, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, protractor, d);
      }
    }
    const zeroHighlight = add('rect', { x: 691, y: cy - 27, width: 34, height: 32, rx: 9, fill: '#f1c75b', opacity: .43 }, protractor);
    const shaded = add('path', { fill: '#f1c75b', opacity: .47 });
    const angleArc = add('path', { fill: 'none', stroke: '#b68a28', 'stroke-width': 3 });
    const rightAngleMark = add('path', { fill: 'none', stroke: '#b68a28', 'stroke-width': 3, display: 'none' });
    const fixed = add('line', { x1: cx, y1: cy, stroke: '#166d57', 'stroke-width': 5, 'stroke-linecap': 'round', 'marker-end': `url(#${unique}-fixed)`, class: 'al-ray' });
    const moving = add('line', { x1: cx, y1: cy, stroke: '#c77535', 'stroke-width': 5, 'stroke-linecap': 'round', 'marker-end': `url(#${unique}-moving)`, class: 'al-ray' });
    add('circle', { cx, cy, r: 9, fill: '#163c34', stroke: 'white', 'stroke-width': 3 });
    add('text', { x: cx, y: cy + 31, 'text-anchor': 'middle', fill: '#163c34', 'font-size': 18, 'font-weight': 800 }, svg, '顶点 · 中心');
    const angleLabel = add('text', { x: cx + 115, y: cy - 70, 'text-anchor': 'middle', fill: '#73530f', 'font-size': 25, 'font-weight': 800 });
    const originLabel = add('text', { x: 740, y: cy + 58, 'text-anchor': 'middle', fill: '#166d57', 'font-size': 18, 'font-weight': 800 });
    const handle = add('g', { class: 'al-drag-handle', tabindex: 0, role: 'slider', 'aria-label': '拖动活动边调整角度', 'aria-valuemin': 1, 'aria-valuemax': 180 });
    add('circle', { r: 30, fill: '#e59250', 'fill-opacity': .15, stroke: '#fff', 'stroke-width': 2 }, handle);
    add('circle', { r: 17, fill: '#d88947', stroke: 'white', 'stroke-width': 5 }, handle);
    add('circle', { r: 4, fill: 'white' }, handle);
    const state = { angle: 60, side: 'right', showProtractor: true, showAnswer: true, extended: false };
    const classify = angle => angle < 90 ? '锐角' : angle === 90 ? '直角' : angle < 180 ? '钝角' : '平角';
    let pointer = null;
    let disposed = false;
    function render(announce = false) {
      const { angle, side, showProtractor, showAnswer, extended } = state;
      const base = side === 'right' ? 0 : 180;
      const actual = side === 'right' ? angle : 180 - angle;
      const length = extended ? 393 : 345;
      const a = point(base, length), b = point(actual, length), h = point(actual, 194);
      fixed.setAttribute('x2', a.x); fixed.setAttribute('y2', a.y);
      moving.setAttribute('x2', b.x); moving.setAttribute('y2', b.y);
      handle.setAttribute('transform', `translate(${h.x} ${h.y})`);
      handle.setAttribute('aria-valuenow', angle);
      handle.setAttribute('aria-valuetext', showAnswer ? `${angle} 度，${classify(angle)}` : '度数已隐藏');
      const shadeStart = point(base, 108);
      shaded.setAttribute('d', `M ${cx} ${cy} L ${shadeStart.x} ${shadeStart.y} ${pathArc(108, base, actual).replace(/^M [^ ]+ [^ ]+ /, '')} Z`);
      angleArc.setAttribute('d', pathArc(108, base, actual));
      angleArc.setAttribute('display', angle === 90 ? 'none' : '');
      rightAngleMark.setAttribute('display', angle === 90 ? '' : 'none');
      const sign = side === 'right' ? 1 : -1;
      rightAngleMark.setAttribute('d', `M ${cx + sign * 35} ${cy} L ${cx + sign * 35} ${cy - 35} L ${cx} ${cy - 35}`);
      const middle = point((base + actual) / 2, 143);
      angleLabel.setAttribute('x', middle.x); angleLabel.setAttribute('y', middle.y + 8);
      angleLabel.textContent = showAnswer ? `${angle}°` : '?°';
      protractor.setAttribute('display', showProtractor ? '' : 'none');
      zeroHighlight.setAttribute('x', side === 'right' ? cx + 258 - 17 : cx - 297 - 17);
      originLabel.setAttribute('x', side === 'right' ? 725 : 175);
      originLabel.setAttribute('fill', side === 'right' ? '#166d57' : '#a65516');
      originLabel.textContent = side === 'right' ? '右边 0° → 读内圈' : '左边 0° → 读外圈';
      originLabel.setAttribute('display', showProtractor ? '' : 'none');
      el('degree').textContent = showAnswer ? `${angle}°` : '?°';
      el('kind').textContent = showAnswer ? classify(angle) : '先估再量';
      el('range').value = angle;
      el('range').setAttribute('aria-valuetext', showAnswer ? `${angle} 度` : '度数已隐藏');
      el('right').setAttribute('aria-pressed', side === 'right');
      el('left').setAttribute('aria-pressed', side === 'left');
      el('protractor').setAttribute('aria-pressed', showProtractor);
      el('protractor').textContent = showProtractor ? '隐藏量角器' : '显示量角器';
      el('answer').setAttribute('aria-pressed', !showAnswer);
      el('answer').textContent = showAnswer ? '隐藏度数' : '揭晓度数';
      el('extend').setAttribute('aria-pressed', extended);
      el('extend').textContent = extended ? '还原边长' : '伸长两条边';
      el('read-guide').textContent = side === 'right' ? '从右边内圈的 0° 起，读内圈刻度。' : '从左边外圈的 0° 起，读外圈刻度。';
      el('insight').textContent = extended ? `两条边画长了，${showAnswer ? `角仍是 ${angle}°` : '两边张开的大小没有改变'}。角的大小与边画得长短无关。` : '角的大小与两条边张开的大小有关，与边画得长短无关。';
      root.querySelectorAll('[data-angle]').forEach(button => button.setAttribute('aria-pressed', showAnswer && Number(button.dataset.angle) === angle));
      if (announce) el('live').textContent = showAnswer ? `${angle} 度，${classify(angle)}。${el('read-guide').textContent}` : '度数已隐藏，请先估一估，再用量角器验证。';
    }
    const setAngle = (value, announce = false) => { state.angle = Math.min(180, Math.max(1, Math.round(value))); render(announce); };
    let enteredAngle = '';
    let freshEntry = true;
    function renderKeypad() {
      const valid = enteredAngle !== '' && Number(enteredAngle) >= 1 && Number(enteredAngle) <= 180;
      el('numpad-display').textContent = enteredAngle === '' ? '—' : enteredAngle + '°';
      el('numpad-error').textContent = enteredAngle === '' ? '点下面的数字' : valid ? '点“确认”调整角度' : '请输入 1～180 的整数';
      el('numpad-error').dataset.invalid = enteredAngle !== '' && !valid;
      el('numpad-confirm').disabled = !valid;
    }
    on(el('open-numpad'), 'click', () => {
      enteredAngle = state.showAnswer ? String(state.angle) : '';
      freshEntry = true;
      renderKeypad();
      el('numpad').showModal();
    });
    root.querySelectorAll('[data-key]').forEach(button => on(button, 'click', () => {
      const key = button.dataset.key;
      if (key === 'clear') enteredAngle = '';
      else if (key === 'delete') enteredAngle = enteredAngle.slice(0, -1);
      else {
        if (freshEntry) enteredAngle = '';
        if (enteredAngle.length < 3) enteredAngle = (enteredAngle + key).replace(/^0+(?=\d)/, '');
      }
      freshEntry = false;
      renderKeypad();
    }));
    on(el('numpad-cancel'), 'click', () => el('numpad').close());
    on(el('numpad-confirm'), 'click', () => {
      const value = Number(enteredAngle);
      if (enteredAngle === '' || value < 1 || value > 180) return;
      setAngle(value, true);
      el('numpad').close();
    });
    on(el('range'), 'input', event => setAngle(Number(event.target.value)));
    on(el('range'), 'change', () => render(true));
    on(el('minus'), 'click', () => setAngle(state.angle - 1, true));
    on(el('plus'), 'click', () => setAngle(state.angle + 1, true));
    on(el('right'), 'click', () => { state.side = 'right'; render(true); });
    on(el('left'), 'click', () => { state.side = 'left'; render(true); });
    on(el('protractor'), 'click', () => { state.showProtractor = !state.showProtractor; render(); });
    on(el('answer'), 'click', () => { state.showAnswer = !state.showAnswer; render(true); });
    on(el('extend'), 'click', () => { state.extended = !state.extended; render(); });
    on(el('reset'), 'click', () => { Object.assign(state, { angle: 60, side: 'right', showProtractor: true, showAnswer: true, extended: false }); render(true); });
    root.querySelectorAll('[data-angle]').forEach(button => on(button, 'click', () => setAngle(Number(button.dataset.angle), true)));
    function drag(event) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const location = svg.createSVGPoint(); location.x = event.clientX; location.y = event.clientY;
      const local = location.matrixTransform(matrix.inverse());
      const dx = local.x - cx, dy = cy - local.y;
      if (Math.hypot(dx, dy) < 22) return;
      const worldAngle = Math.atan2(Math.max(0, dy), dx) * 180 / Math.PI;
      setAngle(state.side === 'right' ? worldAngle : 180 - worldAngle);
    }
    on(handle, 'pointerdown', event => {
      if (pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); pointer = event.pointerId;
      handle.setPointerCapture(pointer); drag(event);
    });
    on(handle, 'pointermove', event => { if (event.pointerId === pointer) { event.preventDefault(); drag(event); } });
    const endDrag = event => {
      if (event.pointerId !== pointer) return;
      if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
      pointer = null;
      if (!disposed) render(true);
    };
    on(handle, 'pointerup', endDrag);
    on(handle, 'pointercancel', endDrag);
    on(handle, 'lostpointercapture', () => { pointer = null; });
    on(handle, 'keydown', event => {
      if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        setAngle(event.key === 'Home' ? 1 : event.key === 'End' ? 180 : state.angle + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1), true);
      }
    });
    render();
    return function cleanup() {
      disposed = true;
      if (el('numpad').open) el('numpad').close();
      if (pointer !== null && handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
      listeners.forEach(remove => remove());
      root.remove();
    };
  };
})();

