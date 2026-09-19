/* Touch-first Blockly editor for the restaurant activity. */
(function (root) {
  'use strict';
  const B = root.Blockly, model = root.BlockAdapter;
  if (!B || !model) return;
  const colours = { motion:'#e8b843', turn:'#56a99a', control:'#8d73b4', event:'#e8b843' };
  class TouchNumberField extends B.FieldNumber {
    showEditor_() {
      const field=this, min=Number(this.min_), max=Number(this.max_);
      const dialog=document.createElement('dialog');dialog.className='blockly-number-pad';dialog.setAttribute('aria-label','输入积木数值');
      let value='';
      dialog.innerHTML='<div class="bn-title"><strong>输入数值</strong><button type="button" data-bn="cancel" aria-label="关闭数字盘">×</button></div><div class="bn-display"><output>—</output></div><div class="bn-keys">'+[1,2,3,4,5,6,7,8,9,'清空',0,'⌫'].map(k=>'<button type="button" data-bn="'+k+'">'+k+'</button>').join('')+'</div><p class="bn-help">请输入 '+min+'—'+max+' 的整数</p><div class="bn-actions"><button type="button" data-bn="cancel">取消</button><button type="button" data-bn="ok">确定</button></div>';
      document.body.appendChild(dialog);
      const output=dialog.querySelector('output'), help=dialog.querySelector('.bn-help');
      const close=()=>{if(dialog.open)dialog.close();dialog.remove();};
      dialog.addEventListener('click',event=>{
        const button=event.target.closest('button[data-bn]');if(!button)return;const key=button.dataset.bn;
        if(key==='cancel'){close();return;}
        if(key==='ok'){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max){help.textContent='请输入 '+min+'—'+max+' 的整数，再点确定。';help.classList.add('error');return;}field.setValue(String(n));close();return;}
        if(key==='清空')value='';else if(key==='⌫')value=value.slice(0,-1);else if(value.length<3)value=(value==='0'?'':value)+key;
        help.classList.remove('error');output.textContent=value||'—';
      });
      dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.showModal();
    }
  }
  const numberField=(value,min,max)=>new TouchNumberField(value,min,max,1);
  function defineBlocks(){
    if(B.Blocks.robot_start)return;
    B.Blocks.robot_start={init(){this.appendDummyInput().appendField('⚑ 程序开始');this.setNextStatement(true);this.setColour(colours.event);this.setTooltip('从这里向下执行，旁边未接上的积木不会运行。');this.setDeletable(false);this.setMovable(false);}};
    B.Blocks.robot_move={init(){this.appendDummyInput().appendField('↑ 直行').appendField(numberField(3,1,6),'VALUE').appendField('格');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colours.motion);this.setTooltip('沿当前横线或竖线前进。');}};
    B.Blocks.robot_left={init(){this.appendDummyInput().appendField('↶ 左转').appendField(numberField(90,1,360),'VALUE').appendField('°');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colours.turn);this.setTooltip('原地向左转。');}};
    B.Blocks.robot_right={init(){this.appendDummyInput().appendField('↷ 右转').appendField(numberField(90,1,360),'VALUE').appendField('°');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colours.turn);this.setTooltip('原地向右转。');}};
    B.Blocks.robot_repeat={init(){this.appendDummyInput().appendField('重复').appendField(numberField(2,1,8),'TIMES').appendField('次');this.appendStatementInput('DO').appendField('执行');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colours.control);this.setTooltip('只重复 C 形槽里的积木；可以拖进、拖出，也可以嵌套。');}};
  }
  const toolbox={kind:'flyoutToolbox',contents:[{kind:'block',type:'robot_move'},{kind:'block',type:'robot_left'},{kind:'block',type:'robot_right'},{kind:'block',type:'robot_repeat'}]};
  function mount(container,options={}){
    defineBlocks();container.classList.add('robot-blockly-shell');container.innerHTML='<div class="robot-block-toolbar" aria-label="积木编辑工具"></div><div class="robot-block-more-panel" role="group" aria-label="更多积木工具" hidden></div><div class="robot-blockly-viewport"><div class="robot-blockly-host" aria-label="积木编程区"></div></div><div class="robot-block-status" aria-live="polite"></div>';
    const toolbar=container.querySelector('.robot-block-toolbar'),morePanel=container.querySelector('.robot-block-more-panel'),viewport=container.querySelector('.robot-blockly-viewport'),host=container.querySelector('.robot-blockly-host'),status=container.querySelector('.robot-block-status');
    // Keep the selected SVG block while the user taps its editing controls.
    // Native button focus otherwise clears Blockly's selection after a tap.
    toolbar.addEventListener('pointerdown',event=>event.preventDefault());
    morePanel.addEventListener('pointerdown',event=>event.preventDefault());
    // Blockly tracks drag distances in screen pixels. CSS zoom on an ancestor
    // otherwise scales rendering but not every connection-distance check.
    // Keep its SVG in physical pixels and let Blockly's own scale enlarge the
    // blocks; the surrounding toolbar still uses the app's display zoom.
    const bodyZoom=()=>Number.parseFloat(getComputedStyle(document.body).zoom)||1;
    let displayZoom=bodyZoom();
    function sizeHost(){const rect=viewport.getBoundingClientRect();host.style.zoom=String(1/displayZoom);host.style.width=rect.width+'px';host.style.height=rect.height+'px';}
    sizeHost();
    const workspace=B.inject(host,{toolbox,renderer:'zelos',trashcan:false,sounds:false,scrollbars:true,zoom:{controls:false,wheel:false,startScale:1.1*displayZoom,maxScale:1.7*displayZoom,minScale:.6*displayZoom},move:{scrollbars:true,drag:true,wheel:false},grid:{spacing:24,length:3,colour:'#d8e3d5',snap:true}});
    let disposed=false,locked=false,mutating=false,notifyFrame=0;
    const refreshSize=()=>{if(disposed)return;const next=bodyZoom();if(next!==displayZoom){const ratio=next/displayZoom;displayZoom=next;workspace.options.zoomOptions.maxScale=1.7*next;workspace.options.zoomOptions.minScale=.6*next;workspace.setScale(workspace.scale*ratio);}sizeHost();workspace.updateInverseScreenCTM();B.svgResize(workspace);};
    // Blockly 13 moved selection helpers onto Blockly.common. Keep the
    // fallback for older bundled builds so toolbar actions never lose the
    // block selected by a touch tap.
    const common=B.common||B;
    const getSelected=()=>{const block=common.getSelected?.()||B.getSelected?.()||workspace.getSelected?.();return block&&block.workspace===workspace&&!block.isDisposed()?block:null;};
    const selectBlock=block=>{if(!block)return;if(common.setSelected)common.setSelected(block);else if(block.select)block.select();};
    const notify=()=>{if(disposed||mutating)return;try{const p=model.workspaceToProgram(workspace);status.textContent=p.disconnectedCount?'旁边有 '+p.disconnectedCount+' 块积木待用，运行只执行“程序开始”下面的连接。':'';status.classList.toggle('has-message',Boolean(p.disconnectedCount));status.classList.remove('error');options.onChange?.(p);}catch(error){status.textContent=error.message;status.classList.add('error','has-message');options.onError?.(error);}};
    const queueNotify=()=>{cancelAnimationFrame(notifyFrame);notifyFrame=requestAnimationFrame(notify);};
    const grouped=action=>{if(locked)return;B.Events.setGroup(true);try{action();}finally{B.Events.setGroup(false);}queueNotify();};
    const moveAside=block=>{block.moveBy(70,35);selectBlock(block);};
    const actions={
      undo:()=>{if(!locked)workspace.undo(false);},redo:()=>{if(!locked)workspace.undo(true);},
      copy:()=>grouped(()=>{const b=getSelected();if(!b||b.type==='robot_start')return;const json=B.serialization.blocks.save(b,{addCoordinates:true,addInputBlocks:true,addNextBlocks:false,saveIds:false});const copy=B.serialization.blocks.append(json,workspace,{recordUndo:true});if(copy)moveAside(copy);}),
      detach:()=>grouped(()=>{const b=getSelected();if(!b||b.type==='robot_start')return;b.unplug(true);moveAside(b);}),
      delete:()=>grouped(()=>{const b=getSelected();if(!b||b.type==='robot_start')return;b.dispose(true);}),
      out:()=>workspace.setScale(Math.max(.6*displayZoom,workspace.scale-.1*displayZoom)),in:()=>workspace.setScale(Math.min(1.7*displayZoom,workspace.scale+.1*displayZoom)),
      center:()=>{const start=workspace.getAllBlocks(false).find(b=>b.type==='robot_start');if(start)workspace.centerOnBlock(start.id);},
      focus:()=>{const planner=container.closest('.block-planner')||container;const focused=planner.classList.toggle('blockly-focused');toolbar.querySelector('[data-block-tool="focus"]').textContent=focused?'返回地图':'放大';refreshSize();},
      help:()=>{const d=document.createElement('dialog');d.className='blockly-help-dialog';d.innerHTML='<h2>拖动积木，把程序拼出来</h2><ol><li>从左侧拖出积木，接到“程序开始”下方。</li><li>把动作拖进循环的 C 形槽，槽内动作才会重复。</li><li>拖积木会带着后面相连的一串；拖循环会带着里面的整组。</li><li>想单独取出一块：先点选它，再点“拆单块”。后面的积木会自动接回。</li><li>积木可拖出循环、交换顺序、嵌套循环。暂放旁边的积木不运行。</li><li>点数字打开触屏数字盘；拖动空白可平移，＋／－可缩放。</li></ol><button type="button">知道了</button>';document.body.appendChild(d);const close=()=>{d.close();d.remove();};d.querySelector('button').onclick=close;d.addEventListener('cancel',()=>d.remove());d.showModal();}
    };
    let moreButton;
    const setMoreOpen=open=>{morePanel.hidden=!open;moreButton?.setAttribute('aria-expanded',String(open));container.classList.toggle('more-open',open);};
    actions.more=()=>setMoreOpen(morePanel.hidden);
    function addTool(parent,key,label,id){const button=document.createElement('button');button.type='button';button.dataset.blockTool=key;button.textContent=label;if(id)button.id=id;button.addEventListener('click',()=>{if(key!=='more')setMoreOpen(false);actions[key]();});parent.appendChild(button);return button;}
    [['undo','撤销'],['redo','重做'],['copy','复制'],['detach','拆单块'],['delete','删除'],['focus','放大'],['more','更多']].forEach(([key,label])=>{const button=addTool(toolbar,key,label);if(key==='more'){moreButton=button;button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','更多积木工具');}});
    [['out','缩小积木'],['in','放大积木'],['center','定位开始'],['help','拖动帮助']].forEach(([key,label])=>addTool(morePanel,key,label));
    [['python','看 Python 逻辑','python-preview',options.onPython],['clear','清空程序','clear-program',options.onClear],['example','教师示例','solution-btn',options.onExample],['verify','从头验证','verify-program',options.onVerify]].forEach(([key,label,id,callback])=>{if(typeof callback==='function'){actions[key]=()=>{if(!locked||key==='python')callback();};addTool(morePanel,key,label,id);}});
    const onOutsidePointer=event=>{if(!morePanel.hidden&&!morePanel.contains(event.target)&&!moreButton.contains(event.target))setMoreOpen(false);};
    const onEscape=event=>{if(event.key==='Escape'&&!morePanel.hidden){setMoreOpen(false);event.preventDefault();event.stopPropagation();}};
    document.addEventListener('pointerdown',onOutsidePointer,true);document.addEventListener('keydown',onEscape,true);
    const listener=event=>{if(!event)return;if(event.type==='selected')options.onSelection?.(getSelected());if(!event.isUiEvent)queueNotify();};workspace.addChangeListener(listener);
    function setProgram(commands){mutating=true;B.Events.setGroup(true);try{const start=model.buildProgram(workspace,commands||[]);start.moveBy(35,35);}finally{B.Events.setGroup(false);mutating=false;}workspace.render();refreshSize();queueNotify();}
    const api={workspace,getProgram:()=>model.workspaceToProgram(workspace),setProgram,
      exportState:()=>B.serialization.workspaces.save(workspace),
      highlight(index){if(index===null||index===undefined){workspace.highlightBlock(null);return;}let p;try{p=model.workspaceToProgram(workspace);}catch(_){return;}workspace.highlightBlock(p.sourceBlockIds[index]||null);},
      clearHighlight:()=>workspace.highlightBlock(null),
      setLocked(value){locked=Boolean(value);container.classList.toggle('is-locked',locked);container.querySelectorAll('[data-block-tool]').forEach(b=>{b.disabled=locked&&['undo','redo','copy','detach','delete','clear','example','verify'].includes(b.dataset.blockTool);});},
      dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(notifyFrame);observer.disconnect();document.removeEventListener('pointerdown',onOutsidePointer,true);document.removeEventListener('keydown',onEscape,true);workspace.removeChangeListener(listener);workspace.dispose();container.replaceChildren();if(root.RobotBlockly.active===api)root.RobotBlockly.active=null;},
      resize:refreshSize
    };
    api.lock=api.setLocked;
    if(options.workspaceState){mutating=true;try{B.serialization.workspaces.load(options.workspaceState,workspace);}catch(error){setProgram(options.commands||[]);options.onError?.(error);}finally{mutating=false;}}else setProgram(options.commands||[]);
    const observer=new ResizeObserver(refreshSize);observer.observe(viewport);root.RobotBlockly.active=api;refreshSize();queueNotify();return api;
  }
  root.RobotBlockly={defineBlocks,mount,TouchNumberField};
})(window);


