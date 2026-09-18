(function(){
'use strict';
const E=window.RobotEngine, main=document.getElementById('main');
const $=s=>document.querySelector(s);
function fitDisplay(){const z=Math.max(1,Math.min(window.innerWidth/1920,window.innerHeight/1080));document.body.style.zoom=String(z);document.documentElement.style.setProperty('--screen-h',Math.round(window.innerHeight/z)+'px');}
fitDisplay();window.addEventListener('resize',fitDisplay);
// A completed tap activates immediately, including after a captured drag on
// touch displays that omit the following compatibility click. Ignore only the
// duplicate trusted click from that same tap; mouse and keyboard keep working.
const touchTaps=new Map(),touchActivations=new Map();
document.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch')return;
 const target=e.target.closest('button');
 if(target&&!target.disabled)touchTaps.set(e.pointerId,{target,x:e.clientX,y:e.clientY,moved:false});
},true);
document.addEventListener('pointermove',e=>{const tap=touchTaps.get(e.pointerId);if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>10)tap.moved=true;},true);
document.addEventListener('pointercancel',e=>{touchTaps.delete(e.pointerId);},true);
document.addEventListener('pointerup',e=>{
 const tap=touchTaps.get(e.pointerId);touchTaps.delete(e.pointerId);
 if(!tap||tap.moved||tap.target.disabled||!tap.target.isConnected)return;
 const rect=tap.target.getBoundingClientRect();
 if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
 const now=performance.now();for(const [target,recent] of touchActivations)if(recent.until<now)touchActivations.delete(target);
 touchActivations.set(tap.target,{until:now+700,x:e.clientX,y:e.clientY});e.preventDefault();tap.target.click();
},true);
document.addEventListener('click',e=>{
 if(!e.isTrusted||e.detail<=0)return;
 const target=e.target.closest('button'),now=performance.now();
 for(const [button,recent] of touchActivations){
  // Opening a dialog or replacing the tapped panel can retarget the browser's
  // compatibility click. Match its physical tap as well as its old button.
  if(recent.until>now&&(button===target||Math.hypot(e.clientX-recent.x,e.clientY-recent.y)<4)){
   e.preventDefault();e.stopImmediatePropagation();touchActivations.delete(button);break;
  }
 }
},true);
window.addEventListener('blur',()=>touchTaps.clear());
let view='restaurant', labCleanup=null, token=0, toastTimer, encouragementTimer, blockUI=null,duelUI=null;
const saved={};
let loopSerial=0;
let completed=[];
try{completed=JSON.parse(localStorage.getItem('angle-explorer-completed')||'[]').filter(n=>[1,2,3].includes(n));}catch(e){}
const state={level:1,commands:[],hint:false,speed:1,result:null,resultCommands:null,programError:null,cursor:0,current:{...E.start,delivered:[]},busy:false,trail:[]};
const quiz={index:0,answered:false,selected:null,correct:0,finished:false};
const names={move:'直行',left:'左转',right:'右转'};
const directionArrows={0:'→',90:'↑',180:'←',270:'↓'};
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function stop(){token++;state.busy=false;if(blockUI&&typeof blockUI.setLocked==='function')blockUI.setLocked(false);}
function clearEncouragement(){
 clearTimeout(encouragementTimer);encouragementTimer=null;
 main.querySelectorAll('.table-cheer').forEach(el=>el.classList.remove('table-cheer'));
 const layer=$('#encouragement-layer');if(layer)layer.innerHTML='';
}
function fresh(){stop();clearEncouragement();state.result=null;state.resultCommands=null;state.programError=null;state.cursor=0;state.current={...E.start,delivered:[]};state.trail=[];}
function programChanged(){return Boolean(state.resultCommands)&&JSON.stringify(state.commands)!==JSON.stringify(state.resultCommands);}
function restoreFrame(){
 state.current=state.result.frames[state.cursor];
 state.trail=state.result.frames.slice(1,state.cursor+1).filter(f=>f.kind==='move').map(f=>({x:f.x,y:f.y}));
 $('#turn-overlay').innerHTML='';drawCurrent();
}
function programError(err){
 stop();state.programError=err.message;blockUI?.clearHighlight?.();
 feedback('先把积木连接好，现场已保留',err.message,'error');updateControls();
}
function programEdited(p){
 const commands=p?.commands||[],changed=JSON.stringify(commands)!==JSON.stringify(state.commands),hadError=Boolean(state.programError);
 state.commands=commands;state.programError=null;
 if(changed){stop();clearEncouragement();blockUI?.clearHighlight?.();}
 saveProgram();
 try{E.compile(commands);}catch(err){programError(err);return;}
 if((changed||hadError)&&state.result){drawCurrent();feedback('现场已保留，改好后接着试','前面没改的步骤不用重走；修改前面的动作或循环，会回到修改处之前再试。');}
 else if(hadError)feedback('积木已连接好，可以试运行','点“下一条”逐步观察，或点“开始运行”验证程序。');
 updateControls();
}
function level(){return E.levels.find(x=>x.id===state.level);}
function saveProgram(){
 const current=saved[state.level]||{};
 const record={...current,commands:state.commands.map(c=>({...c}))};
 if(blockUI&&typeof blockUI.exportState==='function'){
  try{record.workspace=blockUI.exportState();record.scale=blockUI.workspace.scale/(Number.parseFloat(document.body.style.zoom)||1);}catch(err){}
 }
 saved[state.level]=record;
}
function switchLevel(id){saveProgram();fresh();state.level=id;const p=saved[id];state.commands=p?p.commands.map(c=>({...c})):[];renderRestaurant();}
function hero(eyebrow,title,text,badge){return `<section class="hero"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${text}</p></div>${badge?`<div class="hero-badge">${badge}</div>`:''}</section>`;}
function closeDuel(){if(duelUI){duelUI.dispose();duelUI=null;}document.body.classList.remove('duel-active');}
function renderView(next){
 if(next===view&&main.childElementCount)return;
 closeDuel();stop();clearEncouragement();if(blockUI){saveProgram();blockUI.dispose();blockUI=null;}if(labCleanup){labCleanup();labCleanup=null;}
 view=next;document.body.classList.toggle('restaurant-active',view==='restaurant');main.className=view==='restaurant'?'restaurant-main':'';
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(view==='restaurant'){fresh();renderRestaurant();}
 else if(view==='lab'){main.innerHTML=hero('EXPLORE / 01 · 角的度量','把角转一转，把道理看清楚。','拖动一条边，先估一估，再用量角器验证。','<strong>1°</strong><span>把半圆平均分成 180 份<br>每一份所对的角就是 1°</span>')+'<div id="angle-lab-host"></div>';labCleanup=window.mountAngleLab($('#angle-lab-host'));}
 else renderQuiz();
}
function syncBlockly(){if(!blockUI)return true;try{const p=blockUI.getProgram();state.commands=p.commands||[];E.compile(state.commands);state.programError=null;saveProgram();return true;}catch(err){programError(err);return false;}}
function renderRestaurant(){
 const restore=saved[state.level];
 if(blockUI){blockUI.dispose();blockUI=null;}
 main.innerHTML=`<div class="workspace classroom-workspace">
 <div class="restaurant-lesson">
  <section class="restaurant-intro" aria-label="餐厅活动介绍"><span class="eyebrow">PLAY / 02 · 信息技术应用</span><h1>小小指挥官，开餐啦！</h1><p>拼接指令积木，让机器人把餐点送到指定餐桌。全程支持触控。</p></section>
 <section class="board-card" aria-label="机器人餐厅地图">
  <div class="task-bar"><div class="task-heading"><h2>今天的送餐任务</h2><p>出发 / 终点：取餐口　停好朝向：右 →</p></div><button id="hint-btn" class="text-button ${state.hint?'on':''}" aria-pressed="${state.hint}">${state.hint?'隐藏':'显示'}路线</button></div>
  <div class="level-tabs" aria-label="选择任务">${E.levels.map(l=>`<button data-level="${l.id}" class="${state.level===l.id?'active':''}" aria-pressed="${state.level===l.id}" title="${l.title}"><span class="level-num">${completed.includes(l.id)?'✓':('0'+l.id)}</span><span>${l.title}</span></button>`).join('')}</div>
  <div class="mission-strip"><strong>送餐顺序</strong><div class="route-seq"><span>取餐口</span><span class="route-arrow">→</span>${level().targets.map(t=>`<span class="route-chip" data-table-chip="${t}">${t}</span><span class="route-arrow">→</span>`).join('')}<span>取餐口</span></div></div>
  <div class="map-wrap">${mapSVG()}</div>
  <div class="board-footer"><span>朝向 <strong id="heading-text">右 →</strong></span><span>已送达 <strong id="delivered-text">0 / ${level().targets.length}</strong></span><span id="pickup-status" class="pickup-status">终点要求：右 →</span><span id="cycle-text">准备出发</span><button id="task-detail" aria-label="查看任务说明与操作提示">任务与提示</button></div>
 </section>
  <div id="feedback" class="feedback compact-feedback" role="status" aria-live="polite"><span class="feedback-icon">✦</span><div><h3>先想好路线，再下达指令</h3><p>${level().subtitle} 经过待送餐桌就自动送餐；可用“下一条”逐块观察。</p></div></div>
 </div>
 <aside class="planner block-planner" aria-label="积木编程工作区">
  <div class="block-editor real-blockly-editor"><div id="blockly-workspace" class="blockly-workspace" aria-label="Scratch 风格积木编程区"></div></div>
  <div class="run-controls"><button id="back-step" class="reset-button" aria-label="退回上一条动作执行前" title="撤回上一条动作，保留积木">↶ 退一步</button><button id="reset-robot" class="reset-button" aria-label="机器人归位" title="回到取餐口，保留积木，可从头验证">↺ 归位</button><button id="speed-btn" class="speed-button" aria-label="切换运行速度" title="切换运行速度">${state.speed===1?'标准':state.speed===2.5?'快速':'慢速'}</button><button id="step-btn" class="step-button">▷ 下一条</button><button id="run-btn" class="run-button">▶ 开始运行</button></div>
 </aside></div>`;
 drawCurrent();
 const BlocklyUI=window.RobotBlockly;
 const host=$('#blockly-workspace');
 if(BlocklyUI&&host){
   try{
     blockUI=BlocklyUI.mount(host,{commands:state.commands,workspaceState:restore?.workspace,onPython:showPython,onClear:clearProgram,onExample:solutionDialog,onVerify:verifyFromStart,onChange:programEdited,onError:programError});
     if(BlocklyUI.active)blockUI=BlocklyUI.active;
     if(restore?.scale&&blockUI.workspace)blockUI.workspace.setScale(restore.scale*(Number.parseFloat(document.body.style.zoom)||1));
     state.commands=blockUI.getProgram().commands;
     saveProgram();updateControls();
   }catch(err){feedback('积木工作区加载失败','请刷新页面后重试：'+err.message,'error');}
 }
}
function xy(p){return {x:110+p.x*93,y:395-p.y*90};}
function mapSVG(){
 let grid='';for(let x=0;x<=6;x++)grid+=`<line x1="${110+x*93}" y1="125" x2="${110+x*93}" y2="395" stroke="#d2d9c9" stroke-dasharray="4 6"/>`;for(let y=0;y<=3;y++)grid+=`<line x1="110" y1="${395-y*90}" x2="668" y2="${395-y*90}" stroke="#d2d9c9" stroke-dasharray="4 6"/>`;for(let x=0;x<=6;x++)for(let y=0;y<=3;y++)grid+=`<circle cx="${110+x*93}" cy="${395-y*90}" r="3" fill="#c6d0bc"/>`;
 const targets=level().targets;let pts=[E.start,...targets.map(t=>E.tables.find(v=>v.id===t)),E.start].map(p=>{const q=xy(p);return q.x+','+q.y;}).join(' ');
 return `<svg id="map" viewBox="42 50 706 455" role="img" aria-label="餐厅方格地图：左下方是取餐口，也是结束点；机器人送餐后要回到这里并朝右停好。1号桌在右3格，2号桌在右6格；5、4、3号桌分别位于它们上方3格。"><defs><pattern id="floor-dots" width="19" height="19" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#eaeade"/></pattern><filter id="bot-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#234c33" flood-opacity=".18"/></filter></defs>
 <rect x="39" y="57" width="699" height="403" rx="27" fill="#f7f7ed" stroke="#e5e8da"/><rect x="40" y="58" width="697" height="401" rx="27" fill="url(#floor-dots)"/><text x="63" y="88" font-size="12" letter-spacing="3" fill="#93a18a">ANGLE RESTAURANT</text><g opacity=".8"><rect x="677" y="68" width="32" height="11" rx="4" fill="#e2c995"/><ellipse cx="690" cy="65" rx="7" ry="15" fill="#96ad82" transform="rotate(-30 690 65)"/><ellipse cx="701" cy="64" rx="7" ry="13" fill="#b6c59b" transform="rotate(25 701 64)"/></g>
 ${grid}<polyline id="hint-path" points="${pts}" fill="none" stroke="#abc6a4" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="11 12" opacity="${state.hint?'.7':'0'}"/><polyline id="robot-trail" points="" fill="none" stroke="#599c76" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
 <g id="pickup-point" transform="translate(110 395)" aria-label="取餐口：结束时机器人朝右停好"><circle class="pickup-pad" r="39"/><circle class="pickup-ring" r="30"/><path class="pickup-facing-arrow" d="M-36 -50 H27 l-9 -7 m9 7 -9 7"/><text class="pickup-facing-label" x="-5" y="-58" text-anchor="middle">停靠朝向 →</text></g>
 <path d="M110 473 H203 m-5 -4 5 4 -5 4 M110 469 v8" fill="none" stroke="#a3ad91" stroke-width="1.5"/><text x="154" y="495" text-anchor="middle" font-size="14" fill="#79896d">1 格</text>
 ${E.tables.map(t=>{const p=xy(t),active=targets.includes(t.id);return `<g id="table-${t.id}" transform="translate(${p.x} ${p.y})"><rect x="-15" y="-43" width="30" height="12" rx="5" fill="${active?'#d0bb97':'#d9dcca'}"/><rect x="-15" y="31" width="30" height="12" rx="5" fill="${active?'#d0bb97':'#d9dcca'}"/><rect x="-32" y="-31" width="64" height="64" rx="20" fill="#dddac830" transform="translate(0 4)"/><rect class="table-top" x="-32" y="-32" width="64" height="64" rx="20" fill="${active?'#f1d598':'#e9ebdd'}" stroke="${active?'#d9be81':'#d0d7c5'}" stroke-width="2"/><circle r="20" fill="#fffefa" opacity=".83"/><text text-anchor="middle" y="8" font-size="25" font-weight="700" fill="#5a5840">${t.id}</text><g class="table-check" opacity="0"><circle cx="30" cy="-30" r="12" fill="#166d57"/><path d="M24 -30 l4 4 8 -9" fill="none" stroke="white" stroke-width="2.5"/></g></g>`;}).join('')}
 <g id="encouragement-layer" pointer-events="none" aria-hidden="true"></g><rect x="44" y="429" width="132" height="24" rx="6" fill="#e3ebd9" stroke="#b9d0b2"/><text x="110" y="446" text-anchor="middle" font-size="14" font-weight="bold" fill="#4f7755">取餐口 · 起点 / 终点</text><g id="turn-overlay"></g>
 <g id="robot" transform="translate(110 395)"><g id="robot-direction"><path d="M31 -16 L58 0 31 16 Z" fill="#79b195" opacity=".23"/><path d="M37 -7 L47 0 37 7" stroke="#166d57" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g><g filter="url(#bot-shadow)"><rect x="-26" y="-21" width="8" height="35" rx="4" fill="#315d52"/><rect x="18" y="-21" width="8" height="35" rx="4" fill="#315d52"/><rect x="-22" y="-30" width="44" height="52" rx="17" fill="#e4f0df" stroke="#77aa90" stroke-width="2"/><path d="M-15 -25 Q0 -34 15 -25" fill="#adcbb3"/><rect x="-17" y="-17" width="34" height="23" rx="9" fill="#214e45"/><circle cx="-7" cy="-7" r="3.2" fill="#c3efc1"/><circle cx="7" cy="-7" r="3.2" fill="#c3efc1"/><path d="M-5 0 Q0 4 5 0" fill="none" stroke="#9fd3ad" stroke-width="1.4"/><rect x="-10" y="11" width="20" height="4" rx="2" fill="#e5b84d"/><path d="M0 -30 V-39" stroke="#68997b" stroke-width="2"/><circle cy="-40" r="4" fill="#e9bc50"/></g></g>
 </svg>`;
}
function updateControls(){
 if(view!=='restaurant')return;
 if(blockUI&&typeof blockUI.setLocked==='function')blockUI.setLocked(state.busy);
 const clear=$('#clear-program'),solution=$('#solution-btn'),step=$('#step-btn'),run=$('#run-btn'),back=$('#back-step');
 if(clear)clear.disabled=state.busy;if(solution)solution.disabled=state.busy;
 const finished=state.result&&state.cursor>=state.result.frames.length-1;
 const dirty=programChanged(),available=state.commands.length&&!state.programError&&(!finished||dirty);
 if(step)step.disabled=state.busy||!available;if(run)run.disabled=!state.busy&&!available;
 if(back)back.disabled=state.busy||state.cursor===0;
 if(run)run.textContent=state.busy?'Ⅱ 暂停':state.programError?'请先连接积木':dirty?'▶ 接着试':finished?(state.result.status==='success'?'✓ 已完成':'修改后接着试'):state.cursor?'▶ 继续运行':'▶ 开始运行';
 const verify=$('#verify-program');if(verify)verify.disabled=state.busy||!state.commands.length||Boolean(state.programError);
}
function drawRobot(p,heading=p.heading){const q=xy(p);const r=$('#robot');if(r){r.setAttribute('transform',`translate(${q.x} ${q.y})`);$('#robot-direction').setAttribute('transform',`rotate(${-heading})`);}}
function drawCurrent(){
 if(view!=='restaurant')return;
 const p=state.current,dirty=programChanged();drawRobot(p);
 $('#heading-text').textContent=(directionArrows[p.heading] ? E.directionName(p.heading)+' '+directionArrows[p.heading] : '偏转 '+p.heading+'°');
 $('#delivered-text').textContent=p.delivered.length+' / '+level().targets.length;
 const atStart=p.x===E.start.x&&p.y===E.start.y, facingStart=atStart&&p.heading===E.start.heading;
 const pickupStatus=$('#pickup-status');if(pickupStatus){pickupStatus.textContent=atStart?(facingStart?'终点：朝右停好 ✓':'终点：还需朝右'): '终点要求：右 →';pickupStatus.classList.toggle('is-ready',facingStart);pickupStatus.classList.toggle('is-waiting',atStart&&!facingStart);}
 const pickupPoint=$('#pickup-point');if(pickupPoint)pickupPoint.classList.toggle('is-ready',facingStart);
 main.querySelectorAll('[data-table-chip]').forEach(e=>e.classList.toggle('done',p.delivered.includes(Number(e.dataset.tableChip))));
 E.tables.forEach(t=>{$(`#table-${t.id} .table-check`).setAttribute('opacity',p.delivered.includes(t.id)?'1':'0');});
 $('#robot-trail').setAttribute('points',[E.start,...state.trail].map(x=>{const q=xy(x);return q.x+','+q.y;}).join(' '));
 blockUI?.highlight?.(state.cursor>0&&!dirty&&!state.programError?p.sourceIndex:null);
 if(dirty)$('#cycle-text').textContent='现场保留 · 待试运行';
 else if(state.cursor){const it=p.iterations||[];$('#cycle-text').textContent=`执行第 ${p.commandIndex+1} 步`+(it.length?' · 循环 '+it.map(n=>n.iteration+'/'+n.times).join(' → '):'');}
 else $('#cycle-text').textContent='准备出发';
}
function encourageDelivery(tableId){
 const table=$(`#table-${tableId}`),layer=$('#encouragement-layer');if(!table||!layer)return;
 clearTimeout(encouragementTimer);
 main.querySelectorAll('.table-cheer').forEach(el=>el.classList.remove('table-cheer'));
 table.classList.remove('table-cheer');void table.offsetWidth;table.classList.add('table-cheer');
 const target=E.tables.find(t=>t.id===tableId);if(!target)return;
 const q=xy(target),stars=[[-28,-48,'✦'],[28,-43,'✧'],[0,-62,'✦']];
 layer.innerHTML=stars.map(([dx,dy,s])=>`<text class="encouragement-star" x="${q.x+dx}" y="${q.y+dy}">${s}</text>`).join('');
 encouragementTimer=setTimeout(()=>{if(layer.isConnected)layer.innerHTML='';table.classList.remove('table-cheer');encouragementTimer=null;},850);
}
function encourageSuccess(){
 const layer=$('#encouragement-layer');if(!layer)return;
 clearTimeout(encouragementTimer);
 main.querySelectorAll('.table-cheer').forEach(el=>el.classList.remove('table-cheer'));
 const q=xy(E.start),stars=[[-55,-30,'✦'],[60,-30,'✧'],[0,-95,'✦']];
 const turn=$('#turn-overlay');if(turn)turn.innerHTML='';
 layer.innerHTML=stars.map(([dx,dy,s])=>`<text class="encouragement-star success-star" x="${q.x+dx}" y="${q.y+dy}">${s}</text>`).join('');
 encouragementTimer=setTimeout(()=>{if(layer.isConnected)layer.innerHTML='';encouragementTimer=null;},1100);
}
function feedback(title,text,kind=''){const el=$('#feedback');if(!el)return;el.className='feedback compact-feedback '+kind;el.innerHTML=`<span class="feedback-icon">${kind==='success'?'✓':kind==='error'?'!':'✦'}</span><div><h3></h3><p></p></div>`;el.querySelector('h3').textContent=title;el.querySelector('p').textContent=text;}
function turnOverlay(from,frame,pct){const p=xy(from),r=61,a=from.heading*Math.PI/180,d=(frame.turnDirection==='left'?1:-1)*frame.turnDegrees*Math.PI/180*pct;const x1=p.x+r*Math.cos(a),y1=p.y-r*Math.sin(a),x2=p.x+r*Math.cos(a+d),y2=p.y-r*Math.sin(a+d);$('#turn-overlay').innerHTML=(Math.abs(d)>=Math.PI*2-.0001?`<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#efc04b" opacity=".22"/>`:'')+`<path d="M ${p.x} ${p.y} L ${x1} ${y1} A ${r} ${r} 0 ${Math.abs(d)>Math.PI?1:0} ${d>0?0:1} ${x2} ${y2} Z" fill="#efc04b" opacity=".22"/><line x1="${p.x}" y1="${p.y}" x2="${x1}" y2="${y1}" stroke="#7b907c" stroke-width="2" stroke-dasharray="4 4"/><line x1="${p.x}" y1="${p.y}" x2="${x2}" y2="${y2}" stroke="#d29b29" stroke-width="3"/><text x="${p.x}" y="${p.y+76}" text-anchor="middle" font-size="16" font-weight="bold" fill="#95691f">${frame.turnDirection==='left'?'左转':'右转'} ${Math.round(frame.turnDegrees*pct)}°</text>`;}
function animateFrame(frame,runToken){return new Promise(resolve=>{const from={...state.current};const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const duration=reduced?40:(frame.kind==='turn'?900:430)/state.speed;let startTime=null;function step(now){if(runToken!==token||view!=='restaurant'){resolve(false);return;}if(startTime===null)startTime=now;const t=Math.min(1,(now-startTime)/duration);const p=t*t*(3-2*t);if(frame.kind==='move'){drawRobot({x:from.x+(frame.x-from.x)*p,y:from.y+(frame.y-from.y)*p,heading:from.heading});$('#turn-overlay').innerHTML='';}else{const d=(frame.turnDirection==='left'?1:-1)*frame.turnDegrees;drawRobot(from,from.heading+d*p);turnOverlay(from,frame,p);}if(t<1)requestAnimationFrame(step);else resolve(true);}requestAnimationFrame(step);});}
async function play(oneCommand=false){
 if(state.busy){stop();drawCurrent();$('#turn-overlay').innerHTML='';updateControls();feedback('已暂停，现场已保留','点击“继续运行”接着走，也可以修改积木后点“接着试”；“退一步”可撤回上一条动作。');return;}
 if(!syncBlockly())return;
 if(!state.commands.length)return;
 if(!state.result||programChanged()){
  const previous=state.result?{commands:state.resultCommands,result:state.result,cursor:state.cursor}:null;
  const plan=window.RobotReplay.prepare(state.commands,{levelId:state.level,previous});
  state.result=plan.result;state.cursor=plan.cursor;state.resultCommands=state.commands.map(c=>({...c}));restoreFrame();
 }
 const runToken=++token;state.busy=true;updateControls();const first=state.result.frames[state.cursor+1];const index=first?first.commandIndex:-1;
 while(state.cursor<state.result.frames.length-1){const frame=state.result.frames[state.cursor+1];if(oneCommand&&frame.commandIndex!==index)break;if(blockUI&&typeof blockUI.highlight==='function')blockUI.highlight(frame.sourceIndex);feedback(frame.kind==='turn'?'观察：转过了多大的角？':'机器人正在送餐',frame.message);
 if(!await animateFrame(frame,runToken))return;state.cursor++;state.current=frame;if(frame.kind==='move')state.trail.push({x:frame.x,y:frame.y});drawCurrent();if(frame.newlyDelivered)encourageDelivery(frame.newlyDelivered);}
 if(runToken!==token)return;state.busy=false;updateControls();
 if(state.cursor>=state.result.frames.length-1){const r=state.result;feedback(r.status==='success'?'送餐成功！你是出色的小指挥官':r.status==='error'?'机器人停下了，一起检查指令':'再想一步，就更接近目标',r.message,r.status==='success'?'success':r.status==='error'?'error':'');if(r.status==='success')encourageSuccess();if(r.errorSourceIndex!==undefined&&blockUI&&typeof blockUI.highlight==='function')blockUI.highlight(r.errorSourceIndex);if(r.status==='success'&&!completed.includes(state.level)){completed.push(state.level);try{localStorage.setItem('angle-explorer-completed',JSON.stringify(completed));}catch(e){}const b=main.querySelector(`[data-level="${state.level}"] .level-num`);if(b)b.textContent='✓';}}
 else feedback('这一条执行完了，预测下一步',state.current.message+' 继续点“下一条”，或让机器人连续运行。');
}
function backOne(){
 if(state.busy||!state.result||!state.cursor)return;
 clearEncouragement();
 state.cursor=window.RobotReplay.rewindCursor(state.result,state.cursor);restoreFrame();updateControls();
 feedback('已退回上一条动作之前','位置、朝向和送餐进度一起退回，积木保留。可修改这条动作，再点“下一条”或“继续运行”。');
}
function verifyFromStart(){
 if(state.busy||!syncBlockly()||!state.commands.length)return;
 fresh();drawCurrent();$('#turn-overlay').innerHTML='';play();
}
function showInfo(html){$('#info-content').innerHTML=html;const d=$('#info-dialog');if(!d.open)d.showModal();}
function closeInfo(){$('#info-dialog').close();}
function solutionDialog(){
 const l=level();
 const plain=l.solution.map(c=>`${names[c.type]} ${c.value}${c.type==='move'?' 格':'°'}`).join(' → ');
 const loop=l.loopSolution.commands.map(c=>`${names[c.type]} ${c.value}${c.type==='move'?' 格':'°'}`).join(' → ');
 showInfo(`<h2>任务 ${l.id} · 教师示例</h2><p>${l.subtitle}</p><h3>先让学生观察</h3><p>${l.id===1?'到达 ① 号桌后，机器人要怎样转身才能返回？回到取餐口后，怎样确认它仍朝向出发方向？':l.id===2?'四次相同的直角转弯会走出什么图形？哪些动作可以看成一组重复的指令？':'哪些餐桌位于同一条直线上？能否把连续经过的格子合并为一次直行？回到取餐口时还要检查什么？'}</p><h3>一条可行的程序</h3><p>${plain}</p><p>直行改变位置，转向只改变机器人朝向。示例使用左转；在不改变路线、顺序和终点要求的前提下，等价的右转方案也可以成立。</p><h3>用 C 形循环表达</h3><p>把“${loop}”拖进一个“重复 ${l.loopSolution.times} 次”积木的 C 形槽。槽内每个动作都会完整执行 ${l.loopSolution.times} 轮；循环外的动作只执行一次。循环可以整体移动，也可以把动作拖入、拖出或继续嵌套。</p><p>教师示例是可行路线之一。请先让学生预测下一步，再点击“下一条”逐步验证；需要完整验收时，再使用“更多 → 从头验证”。</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="primary" id="load-solution">载入普通示例</button><button class="primary" id="load-loop">载入循环示例</button></div>`);
}
function loadSolution(loop){
 const l=level();let commands=(loop?l.loopSolution.commands:l.solution).map(c=>({...c}));
 if(loop){const id='loop-'+(++loopSerial);commands=[{type:'repeat',value:l.loopSolution.times,id},...commands,{type:'endRepeat',id}];}
 closeInfo();fresh();
 try{
  if(blockUI&&typeof blockUI.setProgram==='function')blockUI.setProgram(commands);
  else{state.commands=commands;delete saved[state.level];renderRestaurant();}
  state.commands=blockUI?blockUI.getProgram().commands:commands;
  saveProgram();drawCurrent();updateControls();feedback('示例已载入，先预测，再运行','把积木拖进紫色 C 形槽；只有槽内积木会重复。拖出即可成为循环外动作。');
 }catch(err){feedback('示例载入失败',err.message,'error');}
}
function guide(){showInfo(`<h2>课堂指南</h2><button id="guide-sources" class="text-button">教材依据与设计说明</button><p>“角度探险家”面向小学四年级《角的度量》相关课时，把角的观察、量角、转向和循环编程放进同一套可触控课堂活动。下面是一种 35—40 分钟的组织方式，教师可按班级节奏调整。</p><div class="guide-grid"><div><h3>01 · 先估再量 / 5 分钟</h3><p>进入“角度实验室”，拖动活动边，先隐藏度数让学生估一估；再显示量角器，比较锐角、直角、钝角和平角。让学生说出“角的大小看张开程度，不看边画得长短”。</p></div><div><h3>02 · 读量角器 / 8 分钟</h3><p>让学生指出量角器中心、与一条边重合的 0° 刻度线，再读另一条边。改变起始边方向后重新判断，强调应从对应的 0° 起读，而不是固定读内圈或外圈。</p></div><div><h3>03 · 机器人送餐 / 15 分钟</h3><p>在“机器人餐厅”先口述路线，再把直行和转向积木接到“程序开始”下面。用“下一条”停下来预测；用“接着试”保留已经验证的前缀。完成三关后，把重复的动作拖进 C 形循环。</p></div><div><h3>04 · 全班挑战 / 8 分钟</h3><p>全班共答适合讲解理由；双人同屏赛适合课堂比赛。两位同学左右各自答题，题序和选项分别打乱，每题限时 15—35 秒。提交后立即公布正确答案，约 1.2 秒自动进入下一题；双方都完成后才出现结果，教师再打开答案解析。</p></div></div><h3>建议追问</h3><ul><li>把一条边画长，角的大小会改变吗？请用实验验证。</li><li>机器人朝上时，向自己的左边转 90° 后朝哪里？</li><li>回到取餐口就算完成了吗？位置和出发朝向是否都恢复？</li><li>连续左转四个直角为什么会回到原来的朝向？</li></ul><h3>触控大屏操作</h3><p>从积木盒拖出动作，靠近连接口后会吸附；拖动一串积木会整体移动。循环是一个完整的紫色 C 形容器，只有槽内动作会重复；动作可以拖入、拖出、交换顺序或嵌套，旁边未接到“程序开始”的积木只是草稿，不会执行。点击积木里的数字打开屏内数字盘：直行 1—6 格，转向 1—360°，重复 1—8 次。工具栏提供“撤销、重做、复制、拆单块、删除、放大、更多”；“更多”中还有缩小/放大积木、定位开始、拖动帮助、看 Python 逻辑、清空程序、教师示例和从头验证。运行时可暂停；“退一步”撤回上一条动作，“归位”保留积木并把机器人放回取餐口。</p><p>双人比赛使用横屏并排布局，建议可用宽度至少 900 px。窄屏会显示空间不足提示并提供“返回全班共答”，不会留下空白答题区。答对使用绿色标记，答错和超时 0 分使用红色标记；颜色只表达结果，不代表左右身份。比赛结果只在双方全部完成后出现，答案解析由教师手动打开。短音效可关闭，系统开启“减少动态效果”时不播放庆祝动画。</p><p>应用没有登录、姓名采集或联网答题；通关标记与本次编排保留在当前浏览器。切换活动会结束当前比赛或动画。若浏览器禁止本地存储，课堂操作仍可继续，但刷新后需要重新编排。</p>`);}
function sources(){showInfo(`<h2>教材依据与设计说明</h2><p>本应用依据用户提供的教材活动图和人民教育出版社当前公开电子教材自主制作。官方目录当前将《角的度量》列为四年级上册第二单元，从印刷第 28 页开始；用户图片中的“信息技术应用：指挥机器人送餐”与官方阅读器的印刷第 35 页相符。电子教材版本可能更新，课堂使用以官方页面显示为准。</p><h3>官方来源</h3><ul><li><a href="https://jc.pep.com.cn/" target="_blank" rel="noreferrer">人民教育出版社 · 中小学教材电子版入口</a></li><li><a href="https://book.pep.com.cn/1221001401261/mobile/index.html#p=41" target="_blank" rel="noreferrer">人教版数学四年级上册 · 官方阅读器第 35 页</a></li><li><a href="https://book.pep.com.cn/1221001401261/mobile/index.html#p=36" target="_blank" rel="noreferrer">第 30 页：度、1°、直角、平角与周角</a></li><li><a href="https://book.pep.com.cn/1221001401261/mobile/index.html#p=37" target="_blank" rel="noreferrer">第 31 页：量角器的使用步骤</a></li></ul><h3>应用对应的知识</h3><p>角的大小由两边张开的程度决定，与两边画出的长度无关。量角时要让量角器中心与顶点重合、0° 刻度线与一条边重合，再从这条边对应的 0° 起读另一条边。机器人活动把“直行格数”和“转向角度”分开：直行改变位置，转向原地改变朝向。左转和右转都以机器人当时的朝向为准。</p><h3>地图与关卡</h3><p>取餐口在左下，出发时朝右；返回后也要朝右停好。餐桌①、②位于底边，③、④、⑤位于上边。任务 1 送达 ①；任务 2 按 ① → ④ → ⑤；任务 3 按 ① → ② → ③ → ④ → ⑤。经过当前待送桌会自动送餐，错序经过不会替代规定顺序。右转等价路线也可以成立，教师示例只是其中一种。</p><h3>循环与程序边界</h3><p>循环是 Blockly 的真实 C 形积木，次数包含第一次执行，只有槽内的语句会重复；循环外的语句按正常顺序执行。支持最多 4 层嵌套，最多连接 40 个动作积木，展开后最多执行 128 条动作。点“看 Python 逻辑”可看到同一程序的顺序和缩进，例如“重复 2 次”对应 <code>for i1 in range(2):</code>；<code>move</code>、<code>turn_left</code> 和 <code>turn_right</code> 是本应用对机器人动作的抽象，不是独立运行的 Python 软件。</p><p class="al-small">本应用是依据教材活动自主制作的课堂互动工具，不是人教社官方数字教材。页面中的角图、方格地图和题目插图均为自主绘制，没有打包教材整页图片；离线课堂文件不依赖这些官方链接。</p>`);}
function angleArt(deg,baseline='right',ruler=false,hide=true){const x=215,y=188,r=145;const sign=baseline==='right'?1:-1;const end={x:x+sign*r*Math.cos(deg*Math.PI/180),y:y-r*Math.sin(deg*Math.PI/180)};let marks='';if(ruler){marks+=`<path d="M70 188 A145 145 0 0 1 360 188 Z" fill="#dcecdf" fill-opacity=".6" stroke="#83a28a"/>`;for(let a=0;a<=180;a+=10){const rad=a*Math.PI/180,xx=x+r*Math.cos(rad),yy=y-r*Math.sin(rad);marks+=`<line x1="${xx}" y1="${yy}" x2="${x+(r-9)*Math.cos(rad)}" y2="${y-(r-9)*Math.sin(rad)}" stroke="#607960"/><text x="${x+(r-23)*Math.cos(rad)}" y="${a===0||a===180?y+16:y-(r-23)*Math.sin(rad)+4}" font-size="9" text-anchor="middle" fill="#486950">${a}</text><text x="${x+(r-41)*Math.cos(rad)}" y="${a===0||a===180?y+16:y-(r-41)*Math.sin(rad)+4}" font-size="9" text-anchor="middle" fill="#926625">${180-a}</text>`;}}
return `<svg viewBox="0 0 430 240" role="img" aria-label="${ruler?'量角器上的角，起始边向'+(baseline==='right'?'右':'左'):'两条射线组成的角'}">${marks}<path d="M${x+sign*52} ${y} A52 52 0 0 ${sign===1?0:1} ${x+sign*52*Math.cos(deg*Math.PI/180)} ${y-52*Math.sin(deg*Math.PI/180)} L${x} ${y} Z" fill="#edc568" opacity=".55"/><path d="M${x+sign*175} ${y} H${x} L${x+sign*175*Math.cos(deg*Math.PI/180)} ${y-175*Math.sin(deg*Math.PI/180)}" fill="none" stroke="#166d57" stroke-width="4" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="5" fill="#183e35"/>${!hide?`<text x="${x+sign*70}" y="${y-27}" font-size="23" font-weight="bold" fill="#966b28">${deg}°</text>`:''}<text x="${x}" y="218" text-anchor="middle" font-size="12" fill="#7a8972">顶点</text></svg>`;}
const questions=[
 {topic:'直角的度数',timeLimitSeconds:15,q:'转过一个直角，机器人转了多少度？',options:['45°','90°','180°','360°'],answer:1,art:()=>angleArt(90),explain:'直角是 90°。可以想象钟面上 3 时整时，时针和分针组成的较小角。'},
 {topic:'从右侧读量角器',timeLimitSeconds:30,q:'看量角器：从右边的 0° 起读，这个角是多少度？',options:['60°','90°','120°','180°'],answer:0,art:()=>angleArt(60,'right',true),explain:'一条边对准右边的 0° 刻度线，要沿着从右边 0° 开始的这一圈读。另一条边经过 60°，这是一个锐角。'},
 {topic:'角的大小与边长',timeLimitSeconds:20,q:'把角的一条边画长一些，角的大小会怎样？',options:['变大','变小','不变','变成直角'],answer:2,art:()=>`<svg viewBox="0 0 580 220" role="img" aria-label="开口相同、边画得一短一长的两个角"><path d="M100 166 H190 M100 166 l45 -78 M330 166 H500 M330 166 l80 -139" fill="none" stroke="#166d57" stroke-width="5"/><path d="M129 166 A29 29 0 0 0 114.5 141 M359 166 A29 29 0 0 0 344.5 141" stroke="#cda042" stroke-width="3" fill="none"/><text x="160" y="203" text-anchor="middle" fill="#677d61" font-size="15">边画得短</text><text x="415" y="203" text-anchor="middle" fill="#677d61" font-size="15">边画得长</text></svg>`,explain:'角的大小与边画得长短没有关系，与两条边张开的大小有关。这两个角张开程度相同，大小就相同。'},
 {topic:'朝向与左转',timeLimitSeconds:25,q:'机器人现在朝上 ↑，左转 90° 后朝哪里？',options:['上 ↑','右 →','下 ↓','左 ←'],answer:3,art:()=>`<svg viewBox="0 0 430 230" role="img" aria-label="机器人朝向上方"><path d="M215 154 V55 m-25 25 25 -25 25 25" stroke="#166d57" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="215" y="204" font-size="20" text-anchor="middle" fill="#688163">站在机器人的角度想一想</text></svg>`,explain:'左、右转要以机器人当时的朝向为准。它朝上时，向自己的左侧转一个直角，就朝左。'},
 {topic:'角的分类',timeLimitSeconds:15,q:'125° 的角，属于哪一类？',options:['锐角','直角','钝角','平角'],answer:2,art:()=>angleArt(125,'right',false,false),explain:'大于 90° 而小于 180° 的角叫钝角。125° 在 90° 和 180° 之间，所以是钝角。'},
 {topic:'直角与周角',timeLimitSeconds:25,q:'连续左转 4 次，每次 90°，一共转了多少度？',options:['90°','180°','270°','360°'],answer:3,art:()=>`<svg viewBox="0 0 430 230" role="img" aria-label="依次左转四次，每次90度"><rect x="144" y="38" width="140" height="140" rx="8" fill="#e7eddf" stroke="#98b28f" stroke-dasharray="5 6"/><text x="215" y="114" text-anchor="middle" font-size="28" font-weight="bold" fill="#166d57">4 × 90°</text><text x="215" y="207" text-anchor="middle" font-size="16" fill="#688163">转一周，回到原来的朝向</text></svg>`,explain:'90° + 90° + 90° + 90° = 360°。转了一周，形成周角，朝向恢复原样。1 周角 = 2 平角 = 4 直角。'},
 {topic:'从左侧读量角器',timeLimitSeconds:35,q:'这次起始边向左，从左边的 0° 起读是多少度？',options:['50°','90°','130°','180°'],answer:2,art:()=>angleArt(130,'left',true),explain:'起始边向左，就从左边的 0° 开始读。这条刻度对应 130°；50° 属于另一圈。先估它是钝角，也能帮助检查读数。'},
 {topic:'半周与恢复朝向',timeLimitSeconds:30,q:'送完餐回到取餐口后，机器人朝左 ←。还要怎样恢复出发时朝右 →？',options:['直行 1 格','左转 90°','右转 90°','转 180°'],answer:3,art:()=>`<svg viewBox="0 0 520 220" role="img" aria-label="现在朝左，需要恢复朝右"><text x="135" y="130" text-anchor="middle" font-size="78" fill="#ad7d3a">←</text><text x="260" y="120" text-anchor="middle" font-size="27" fill="#99a48f">?</text><text x="385" y="130" text-anchor="middle" font-size="78" fill="#166d57">→</text><text x="135" y="178" text-anchor="middle" font-size="17" fill="#75896b">现在朝向</text><text x="385" y="178" text-anchor="middle" font-size="17" fill="#75896b">出发朝向</text></svg>`,explain:'从向左变成向右，要转半周，也就是 180°。左转 180° 和右转 180° 都能恢复出发朝向。'}
];
function renderQuiz(){
 const q=questions[quiz.index];
 main.innerHTML=hero('CHALLENGE / 03 · 学以致用','角度小达人，轮到你了。','先独立思考，再说说理由。也可以请两名同学上屏，左右同时挑战。','<strong>8</strong><span>道课堂小挑战<br>观察、测量、判断与应用</span>')+`<div class="quiz-layout"><section class="quiz-card" aria-label="角度挑战题目">${quiz.finished?`<div class="quiz-result"><span class="eyebrow">CHALLENGE COMPLETE</span><h2>挑战完成，给思考鼓鼓掌！</h2><div class="big-score">${quiz.correct}<small> / 8 题</small></div><p>${quiz.correct>=7?'角度知识掌握得很棒，试着把思路讲给同学听。':'每一次修正都是进步。回到实验室，动手验证刚才的发现吧。'}</p><button id="quiz-restart" class="primary">再挑战一次</button> <button class="text-button" data-goto="lab">去角度实验室</button></div>`:`<div class="quiz-topline"><span>第 ${quiz.index+1} / ${questions.length} 题</span><div class="progress-track"><div style="width:${(quiz.index+(quiz.answered?1:0))/questions.length*100}%"></div></div><span>全班一起想</span></div><h2>${q.q}</h2><div class="quiz-art">${q.art()}</div><div class="quiz-options">${q.options.map((o,i)=>`<button class="quiz-option ${quiz.answered?(i===q.answer?'correct':i===quiz.selected?'wrong':''):''}" data-answer="${i}" ${quiz.answered?'disabled':''}><span>${'ABCD'[i]}</span>${o}</button>`).join('')}</div>${quiz.answered?`<div class="quiz-answer" role="status"><strong>${quiz.selected===q.answer?'✓ 答对了，说说你是怎么想的！':'再看一看：正确答案是 '+q.options[q.answer]}</strong><p>${q.explain}</p><button id="quiz-next" class="primary">${quiz.index===questions.length-1?'查看挑战结果':'下一题 →'}</button></div>`:''}`}</section><aside class="quiz-aside"><span class="eyebrow">CLASSROOM MOMENT</span><h3 style="margin-top:10px">把思考的机会交给学生</h3><div class="team-tabs"><button id="whole-class" class="active">全班共答</button><button id="team-mode">双人同屏赛</button></div><div class="score-list"><div class="score-item"><span>共同答对</span><strong>${quiz.correct} <small style="font-size:14px">题</small></strong></div></div><p>全班共答：先表达判断，再点选答案。可以请另一名学生用量角器或手势说明理由。</p><p>双人同屏赛：两名同学一左一右，各答同样的 8 道题，题序与选项分别打乱。逐题限时，超时 0 分；同分并列。双方完成后先看结果，再由老师打开解析。</p><button id="quiz-reset" class="text-button">↺ 重新开始挑战</button></aside></div>`;
}
function restartQuiz(){Object.assign(quiz,{index:0,answered:false,selected:null,correct:0,finished:false});renderQuiz();}
function startDuel(){
 closeDuel();document.body.classList.add('duel-active');main.className='duel-main';
 const matchQuestions=questions.map(q=>({...q,art:()=>q.art().replaceAll('font-size="9"','font-size="12"')}));
 duelUI=window.mountQuizDuel(main,{questions:matchQuestions,onExit:()=>{closeDuel();main.className='';renderQuiz();}});
}
main.addEventListener('click',e=>{
 const b=e.target.closest('button');if(b&&b.disabled)return;
 if(b&&b.dataset.goto){renderView(b.dataset.goto);return;}
 if(view==='restaurant'){
  if(b&&b.dataset.level){switchLevel(Number(b.dataset.level));return;}
  if(b){switch(b.id){
   case'task-detail':showInfo(`<h2>${level().title}</h2><p>${level().subtitle}</p><h3>任务目标</h3><p>机器人从取餐口出发，初始朝向右侧的 ① 号桌。要按指定顺序送餐，回到取餐口，并恢复“朝右”停靠；只回到起点但朝向不对，任务仍未完成。</p><h3>建议操作</h3><p>先把路线说出来，再拖积木接到“程序开始”下面。用“下一条”逐块观察并预测位置、朝向和送餐进度；需要连续播放时点“开始运行”。运行中可暂停，速度按钮可切换慢速、标准和快速。</p><h3>现场保留与重试</h3><p>修改积木不会把机器人强制归零。点“接着试”时，未改变的前缀会保留；修改前面的动作，会从受影响动作之前重试；修改循环次数或循环体，会从该循环第一次进入前重试。“退一步”只撤回运行进度并保留积木，“归位”把机器人放回取餐口但也保留积木。</p><h3>检查程序</h3><p>只有接在“程序开始”下方的连接链会运行。循环必须使用完整的 C 形容器，槽内动作才会重复；游离积木可暂存比较，但不会执行。数字字段可通过屏内数字盘修改：直行 1—6 格，转向 1—360°，重复 1—8 次。方案调好后，打开“更多 → 从头验证”可从取餐口完整播放一遍。</p>`);break;
   case'hint-btn':state.hint=!state.hint;b.classList.toggle('on',state.hint);b.textContent=(state.hint?'隐藏':'显示')+'路线';b.setAttribute('aria-pressed',String(state.hint));$('#hint-path').setAttribute('opacity',state.hint?'.7':'0');break;
   case'run-btn':play();break;case'step-btn':play(true);break;case'back-step':backOne();break;
   case'reset-robot':fresh();drawCurrent();$('#turn-overlay').innerHTML='';updateControls();feedback('机器人已归位，积木保留','从取餐口出发，朝右看向 ① 号桌。先预测下一步，再执行吧。');break;
   case'speed-btn':state.speed=state.speed===1?2.5:state.speed===2.5?.6:1;b.textContent=(state.speed===1?'标准':state.speed===2.5?'快速':'慢速');break;
  }return;}
 }else if(view==='quiz'&&b&&!duelUI){
  if(b.dataset.answer!==undefined&&!quiz.answered){quiz.selected=Number(b.dataset.answer);quiz.answered=true;if(quiz.selected===questions[quiz.index].answer)quiz.correct++;renderQuiz();}
  else if(b.id==='quiz-next'){if(quiz.index===questions.length-1)quiz.finished=true;else{quiz.index++;quiz.answered=false;quiz.selected=null;}renderQuiz();}
  else if(['quiz-restart','quiz-reset'].includes(b.id))restartQuiz();
  else if(b.id==='team-mode')startDuel();
 }
});
function clearProgram(){
 if(state.busy)return;
 try{blockUI?.setProgram([]);}catch(err){feedback('清空失败',err.message,'error');return;}
 state.commands=[];stop();state.programError=null;saveProgram();drawCurrent();feedback('程序已清空，现场保留','从积木盒拖入动作，接到“程序开始”下面。点“归位”可让机器人回取餐口。');updateControls();
}
function showPython(){if(!syncBlockly())return;let code;try{code=E.toPython(state.commands);}catch(e){showInfo('<h2>先把积木连接好</h2><p id="python-error"></p>');$('#python-error').textContent=e.message;return;}showInfo('<h2>把积木读成 Python 逻辑</h2><p>这是一份只读的控制流程预览：积木从上到下对应语句顺序，紫色 C 形循环槽中的动作对应缩进的循环体，循环下方的动作会在循环完成后继续执行。把动作拖出循环，预览中的缩进也会随之消失；嵌套循环会出现多层缩进。</p><pre class="python-code"></pre><p><code>move</code> 表示直行，<code>turn_left</code> / <code>turn_right</code> 表示原地转向。代码用于帮助学生理解“重复”和缩进，实际运行仍由本应用的机器人模型完成，不需要安装 Python。</p>');$('.python-code').textContent=code||'# 还没有动作，请先添加积木';}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>renderView(b.dataset.view)));
$('.brand').addEventListener('click',e=>{e.preventDefault();renderView('restaurant');});$('#guide-btn').addEventListener('click',guide);$('#source-btn').addEventListener('click',sources);$('#close-info').addEventListener('click',closeInfo);
$('#info-dialog').addEventListener('click',e=>{if(e.target.id==='guide-sources')sources();else if(e.target.id==='load-solution')loadSolution(false);else if(e.target.id==='load-loop')loadSolution(true);else if(e.target===$('#info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeInfo();}});
$('#fullscreen-btn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('请按键盘 F11 进入浏览器全屏。');}catch(e){toast('当前窗口未允许网页全屏，请按 F11。');}});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen-btn').innerHTML=document.fullscreenElement?'⛶ <span>退出全屏</span>':'⛶ <span>全屏</span>';});
const initialActivity=new URLSearchParams(window.location.search).get('activity');
renderView(initialActivity==='duel'||initialActivity==='quiz'?'quiz':initialActivity==='lab'?'lab':'restaurant');
if(initialActivity==='duel')startDuel();
})();

