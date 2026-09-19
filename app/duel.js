(function(){
'use strict';
const escapeText=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clockText=milliseconds=>{const seconds=Math.floor(Math.max(0,milliseconds)/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};

window.mountQuizDuel=function(host,{questions,onExit}){
 const M=window.QuizDuelModel,state=M.create(questions),names=['左侧同学','右侧同学'];
 let disposed=false,soundEnabled=true,audio=null,countdownTimer=null,countdownNumber=3,countdownPaused=false,tickTimer=null;
 let resultShown=false;
 let summaryData=null,summarySource=null,summaryFilter='all';
 const summaryRevealed=new Set();
 const timers=new Set(),voices=new Set();
 host.quizDuelState=state;
 host.innerHTML=`<section class="duel-shell" data-duel-phase="ready" aria-label="双人同屏答题比赛">
  <div class="duel-toolbar"><div class="duel-title"><span class="duel-title-icon" aria-hidden="true">∠</span><h1>双人同屏赛</h1></div><div class="duel-tools"><button id="whole-class" type="button">全班共答</button><button id="duel-result-open" type="button" hidden>查看结果</button><button id="duel-review-open" type="button" hidden>查看答案解析</button><button id="duel-sound" type="button" aria-pressed="true">音效：开</button><button id="duel-pause" type="button" disabled>暂停</button><button id="duel-restart" type="button">再来一局</button></div></div>
  <div class="duel-rules"><span>同样 ${questions.length} 题，各自乱序 · 答对 1 分，超时 0 分 · 同分并列，用时只作参考</span><strong id="duel-status" role="status">两位同学分别点击准备</strong></div>
  <div class="duel-narrow-warning" role="alert" hidden>
   <div class="duel-narrow-card"><div class="duel-narrow-icon" aria-hidden="true">↔</div><h2>屏幕空间不足</h2><p>双人同屏赛需要横屏并排显示两位同学的答题区。</p><p>请把浏览器切换到横屏，或使用宽度至少 <b>900 px</b> 的窗口。</p><small>当前可用宽度：<b data-duel-narrow-width>--</b> px</small><button id="duel-narrow-exit" type="button" class="duel-primary">返回全班共答</button></div>
  </div>
  <div class="duel-result-banner" hidden role="status"></div>
  <div class="duel-arena">${names.map((name,i)=>`<section class="duel-player duel-player-${i}" data-player="${i}" aria-label="${name}答题区">
   <header class="duel-player-header"><div class="duel-identity"><span class="duel-avatar" aria-hidden="true">${i===0?'∠':'☀'}</span><div><h2>${name}</h2><span data-duel-progress="${i}">等待准备</span></div></div><div class="duel-metrics"><span class="duel-question-timer" data-duel-question-timer="${i}"><span>本题倒计时</span><b data-duel-time-left="${i}">--</b></span><span class="duel-clock">总用时 <b data-duel-time="${i}">0:00</b></span><strong><span data-duel-score="${i}">0</span><small>分</small></strong></div></header>
   <div class="duel-progress-track" aria-hidden="true"><div data-duel-progress-bar="${i}"></div></div><div class="duel-stage" data-duel-stage="${i}"></div><div class="duel-review" data-duel-review="${i}" hidden></div><div class="duel-image-view" data-duel-image-view="${i}" hidden></div>
  </section>`).join('')}
  <div class="duel-countdown" hidden aria-live="assertive"><div><p>两位同学已准备</p><strong>3</strong><span>看清题目，再选答案</span></div></div>
  <div class="duel-pause-mask" hidden><div><span aria-hidden="true">Ⅱ</span><h2>比赛已暂停</h2><p>题目与进度已保留，计时也停下来了。</p><button type="button" class="duel-primary" data-duel-resume>继续比赛</button></div></div>
  </div>
  <dialog class="duel-result-dialog" aria-labelledby="duel-result-title"><header class="duel-result-header"><span class="duel-summary-eyebrow">本局完成</span><button type="button" data-result-close aria-label="关闭结果">关闭结果 ✕</button></header><div class="duel-result-body"><div class="duel-result-trophy" aria-hidden="true">🏆</div><h2 id="duel-result-title" data-duel-result-title>比赛结果</h2><p data-duel-result-subtitle>两位同学都完成了挑战。</p><div class="duel-result-scoreboard"><div><span>左侧同学</span><b data-duel-result-score="0">0</b><small>答对 <i data-duel-result-correct="0">0</i> 题 · 超时 <i data-duel-result-timeout="0">0</i> 题</small></div><strong>:</strong><div><span>右侧同学</span><b data-duel-result-score="1">0</b><small>答对 <i data-duel-result-correct="1">0</i> 题 · 超时 <i data-duel-result-timeout="1">0</i> 题</small></div></div><div class="duel-result-actions"><button type="button" class="duel-primary" id="duel-result-view" data-result-review>查看答案解析</button><button type="button" data-result-close>回到比赛</button></div></div></dialog>
  <dialog class="duel-summary" aria-labelledby="duel-summary-title"><header class="duel-summary-header"><div><span class="duel-summary-eyebrow">一起回顾 · 说出理由</span><h2 id="duel-summary-title">课堂总结</h2></div><button type="button" data-summary-close aria-label="关闭课堂总结">关闭总结 ✕</button></header><div class="duel-summary-award"></div><div class="duel-summary-workspace"><aside class="duel-summary-overview"><div class="duel-summary-overview-title"><h3>题目总览</h3><p data-summary-counts></p></div><div class="duel-summary-filters" aria-label="筛选总结题目"><button type="button" data-summary-filter="all" aria-pressed="true">全部题目</button><button type="button" data-summary-filter="wrong" aria-pressed="false">只看错题</button></div><div class="duel-summary-columns" aria-hidden="true"><span>知识点</span><span>左侧</span><span>右侧</span></div><div class="duel-summary-list"></div></aside><section class="duel-summary-detail" aria-label="当前题目讲解"></section></div></dialog>
 </section>`;
 const shell=host.querySelector('.duel-shell'),panels=[...host.querySelectorAll('.duel-player')],stages=[...host.querySelectorAll('.duel-stage')],pauseButton=host.querySelector('#duel-pause'),pauseMask=host.querySelector('.duel-pause-mask'),countdown=host.querySelector('.duel-countdown'),banner=host.querySelector('.duel-result-banner'),status=host.querySelector('#duel-status'),narrowWarning=host.querySelector('.duel-narrow-warning'),narrowWidth=narrowWarning?.querySelector('[data-duel-narrow-width]');
 const summary=host.querySelector('.duel-summary'),resultDialog=host.querySelector('.duel-result-dialog'),resultOpen=host.querySelector('#duel-result-open'),reviewOpen=host.querySelector('#duel-review-open');

 function later(fn,delay){const handle=setTimeout(()=>{timers.delete(handle);if(!disposed)fn();},delay);timers.add(handle);return handle;}
 function clearCountdown(){if(countdownTimer!==null){clearTimeout(countdownTimer);timers.delete(countdownTimer);countdownTimer=null;}}
 function unlockSound(){
  if(!soundEnabled||disposed)return;
  try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio)audio=new Audio();}if(audio&&audio.state==='suspended')audio.resume().catch(()=>{});}catch(_error){}
 }
 function stopSounds(){for(const voice of voices){try{voice.stop();}catch(_error){}}voices.clear();}
 function playSound(kind){
  if(!soundEnabled||!audio||audio.state!=='running'||disposed)return;
  const notes={ready:[440],tick:[523],start:[523,659,784],correct:[659,880],wrong:[294,247],finish:[523,659,784,1047]}[kind]||[523];
  try{notes.forEach((hz,index)=>{const at=audio.currentTime+index*.12,osc=audio.createOscillator(),gain=audio.createGain();voices.add(osc);osc.type=kind==='wrong'?'sine':'triangle';osc.frequency.value=hz;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.065,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.16);osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.18);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};});}catch(_error){}
 }
 function renderReady(i){
  const p=state.players[i];
  stages[i].className='duel-stage duel-ready-stage';
  stages[i].innerHTML=`<div class="duel-ready-art" aria-hidden="true"><span>∠</span><i>90°</i></div><h3>${p.ready?'准备好了！':'站在这一侧，准备挑战'}</h3><p>${p.ready?'等另一位同学准备，就一起开始。':'独立观察、判断，每道题只有一次作答机会。'}<br>提交后显示答案，随后自动进入下一题。</p><button type="button" class="duel-primary duel-ready-button" data-duel-ready="${i}" ${p.ready?'disabled':''}>${p.ready?'✓ 已准备':'我准备好了'}</button><small>每题 15–35 秒，超时 0 分；双方完成后由老师打开解析。</small>`;
  updatePlayer(i);
 }
 function formatRemaining(milliseconds){
  const seconds=Math.max(0,Math.ceil(milliseconds/1000));
  return `00:${String(seconds).padStart(2,'0')}`;
 }
 function startQuestionTimer(i){
  const timer=host.querySelector(`[data-duel-question-timer="${i}"]`);timer?.classList.remove('is-low','is-timeout');
  updateQuestionTimer(i);
 }
 function updateQuestionTimer(i){
  const timer=host.querySelector(`[data-duel-question-timer="${i}"]`),output=host.querySelector(`[data-duel-time-left="${i}"]`);
  if(!timer||!output)return;
  const remaining=M.remaining(state,i,performance.now()),player=state.players[i];
  if(state.phase==='playing'&&!player.answered&&!player.finished&&remaining<=0){timeoutQuestion(i);return;}
  output.textContent=state.phase==='ready'||state.phase==='countdown'?'--':`剩余 ${formatRemaining(remaining)}`;
  timer.classList.toggle('is-low',!player.answered&&remaining>0&&remaining<=5000);
 }
 function timeoutQuestion(i){
  const q=M.current(state,i);if(!q||state.phase!=='playing'||state.players[i].answered||state.players[i].finished)return;
  const outcome=typeof M.timeout==='function'?M.timeout(state,i,q.id,performance.now()):null;
  if(!outcome||!outcome.ok)return;
  applyTimeout(i,outcome);syncControls();playSound('wrong');
  if(state.phase==='result')finishRound();
 }
 function renderQuestion(i){
  const q=M.current(state,i);if(!q)return;
  stages[i].className='duel-stage duel-question-stage';
  stages[i].removeAttribute('data-duel-timeout');
  stages[i].innerHTML=`<h3 class="duel-question" data-question="${escapeText(q.id)}">${escapeText(q.q)}</h3><div class="duel-art">${typeof q.art==='function'?q.art():''}<button type="button" class="duel-zoom-button" data-duel-image-open="${i}" data-question="${escapeText(q.id)}" aria-label="${names[i]}放大题目图">＋ 放大图</button></div><div class="duel-options">${q.options.map((option,slot)=>`<button type="button" class="duel-option" data-duel-answer="${slot}" data-player="${i}" data-question="${escapeText(q.id)}"><span class="duel-option-letter">${'ABCD'[slot]}</span><span>${escapeText(option)}</span><i class="duel-option-mark" aria-hidden="true"></i></button>`).join('')}</div><div class="duel-answer-feedback" aria-live="polite"><div class="duel-feedback-copy"><strong>看清题目，再作答</strong><p>每题限时独立计时，选择后会公布答案。</p></div><button type="button" class="duel-primary" data-duel-next="${i}" data-question="${escapeText(q.id)}" disabled>下一题 →</button></div>`;
  startQuestionTimer(i);
  updatePlayer(i);
 }
 function updatePlayer(i){
  const p=state.players[i],answered=p.answers.length;
  host.querySelector(`[data-duel-score="${i}"]`).textContent=p.score;
  host.querySelector(`[data-duel-progress="${i}"]`).textContent=p.finished?`已完成 ${questions.length} / ${questions.length} 题`:state.phase==='ready'||state.phase==='countdown'?(p.ready?'已准备':'等待准备'):`第 ${p.index+1} / ${questions.length} 题`;
  host.querySelector(`[data-duel-progress-bar="${i}"]`).style.width=`${answered/questions.length*100}%`;
  host.querySelector(`[data-duel-time="${i}"]`).textContent=clockText(M.elapsed(state,i,performance.now()));
  panels[i].classList.toggle('duel-finished',p.finished);
 }
 function scheduleAutoNext(i,questionId){
  later(()=>{
   if(disposed)return;
   if(state.phase==='paused'){scheduleAutoNext(i,questionId);return;}
   const player=state.players[i],question=M.current(state,i);
   if(state.phase!=='playing'||!player||player.finished||!player.answered||!question||question.id!==questionId)return;
   if(M.next(state,i,questionId,performance.now()).ok){renderQuestion(i);syncControls();}
  },1200);
 }
 function applyAnswer(i,outcome){
  const p=state.players[i],q=M.current(state,i),feedback=stages[i].querySelector('.duel-answer-feedback');
  stages[i].removeAttribute('data-duel-timeout');
  stages[i].querySelectorAll('[data-duel-answer]').forEach(button=>{const slot=Number(button.dataset.duelAnswer),correct=slot===q.answer,selected=slot===p.selected;button.disabled=true;button.classList.toggle('is-submitted',selected);button.classList.toggle('is-correct',correct);button.classList.toggle('is-wrong',selected&&!correct);button.setAttribute('aria-pressed',String(selected));button.querySelector('.duel-option-mark').textContent=correct?'✓':selected?'×':'';});
  feedback.className=`duel-answer-feedback ${outcome.correct?'is-correct':'is-wrong'}`;
  feedback.dataset.answerRevealed='true';
  feedback.querySelector('strong').textContent=p.finished?(outcome.correct?'✓ 答对了！本轮完成':'× 答错了 · 本轮完成'):(outcome.correct?'✓ 答对了！+1 分':'× 答错了 · 本题 0 分');
  feedback.querySelector('p').textContent=`正确答案：${q.options[q.answer]}${p.finished?' · 等待另一位同学':' · 下一题将自动开始'}`;
  const next=feedback.querySelector('button');next.disabled=false;next.textContent=p.finished?'已完成':'下一题 →';
  if(p.finished){next.removeAttribute('data-duel-next');next.hidden=true;}
  panels[i].classList.remove('duel-score-pop');void panels[i].offsetWidth;panels[i].classList.add('duel-score-pop');
  later(()=>panels[i].classList.remove('duel-score-pop'),420);
  updatePlayer(i);
  if(!p.finished)scheduleAutoNext(i,q.id);
 }
 function applyTimeout(i,outcome){
  const p=state.players[i],q=M.current(state,i),feedback=stages[i].querySelector('.duel-answer-feedback'),timer=host.querySelector(`[data-duel-question-timer="${i}"]`);
  stages[i].setAttribute('data-duel-timeout','true');stages[i].querySelectorAll('[data-duel-answer]').forEach(button=>{const correct=Number(button.dataset.duelAnswer)===q.answer;button.disabled=true;button.classList.toggle('is-correct',correct);button.classList.toggle('is-timeout',!correct);button.querySelector('.duel-option-mark').textContent=correct?'✓':'—';});
  if(timer){timer.classList.remove('is-low');timer.classList.add('is-timeout');timer.querySelector('[data-duel-time-left]')?.replaceChildren('00:00');}
  feedback.className='duel-answer-feedback is-timeout';feedback.setAttribute('data-duel-timeout','true');feedback.dataset.answerRevealed='true';feedback.querySelector('strong').textContent='⌛ 本题超时 · 0 分';feedback.querySelector('p').textContent=`正确答案：${q.options[q.answer]}${p.finished?' · 等待另一位同学':' · 下一题将自动开始'}`;
  const next=feedback.querySelector('button');next.disabled=Boolean(p.finished);next.textContent=p.finished?'已完成':'下一题 →';
  if(p.finished){next.removeAttribute('data-duel-next');next.hidden=true;}
  updatePlayer(i);
  if(!p.finished)scheduleAutoNext(i,q.id);
 }
 function syncControls(){
  const paused=state.phase==='paused'||countdownPaused,active=state.phase==='playing'||state.phase==='paused'||state.phase==='countdown';
  shell.dataset.duelPhase=paused?'paused':state.phase;
  pauseButton.disabled=!active;pauseButton.textContent=paused?'继续':'暂停';
  resultOpen.hidden=state.phase!=='result';reviewOpen.hidden=state.phase!=='result';
  pauseMask.hidden=!paused;
  countdown.hidden=state.phase!=='countdown'||countdownPaused;
  for(let i=0;i<2;i++){
   const p=state.players[i];
   stages[i].querySelectorAll('[data-duel-answer]').forEach(button=>{button.disabled=state.phase!=='playing'||p.answered||p.finished;});
   stages[i].querySelectorAll('[data-duel-next]').forEach(button=>{button.disabled=state.phase!=='playing'||!p.answered||p.finished;});
  }
  status.textContent=paused?'已暂停 · 进度与用时保留':state.phase==='countdown'?'准备开赛':state.phase==='playing'?(state.players.some(p=>p.finished)?'一位已完成 · 另一位继续加油':'独立作答 · 各自前进'):state.phase==='result'?'比赛完成 · 可查看结果或答案解析':'两位同学分别点击准备';
  for(let i=0;i<2;i++)updateQuestionTimer(i);
 }
 function finishRound(){
  const result=M.result(state);
  if(!result)return;
  banner.hidden=true;
  panels.forEach((panel,i)=>{closeReview(i);closeImage(i);panel.classList.toggle('duel-winner',result.tie||result.winner===i);});
  renderResultDialog(result);syncControls();
  if(!resultShown){resultShown=true;resultDialog.showModal();celebrateResult();playSound('finish');}
 }
 function resultMetrics(i){
  const p=state.players[i],answers=p.answers||[],correct=answers.filter(answer=>answer.correct&&!answer.timeout).length,timeouts=answers.filter(answer=>answer.timeout).length;
  return {correct,timeouts};
 }
 function renderResultDialog(result){
  const winnerText=result.tie?'同分并列！':`${names[result.winner]}获胜！`;
  resultDialog.querySelector('[data-duel-result-title]').textContent=winnerText;
  resultDialog.querySelector('[data-duel-result-subtitle]').textContent='两位同学都完成了挑战。一起看看哪些题答对，哪些题值得再讲一讲。';
  for(let i=0;i<2;i++){const metrics=resultMetrics(i);resultDialog.querySelector(`[data-duel-result-score="${i}"]`).textContent=result.scores[i];resultDialog.querySelector(`[data-duel-result-correct="${i}"]`).textContent=metrics.correct;resultDialog.querySelector(`[data-duel-result-timeout="${i}"]`).textContent=metrics.timeouts;}
  resultDialog.querySelector('.duel-result-trophy').textContent=result.tie?'✦':'🏆';
 }
 function celebrateResult(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const layer=document.createElement('div');layer.className='duel-result-confetti';layer.setAttribute('aria-hidden','true');layer.innerHTML=Array.from({length:18},(_,i)=>`<i style="--x:${5+i*5.1}%;--d:${(i%5)*.05}s">${i%2?'▪':'✦'}</i>`).join('');resultDialog.querySelector('.duel-result-body').appendChild(layer);later(()=>layer.remove(),1600);
 }
 function fitSummary(){
  const zoom=Number.parseFloat(getComputedStyle(document.body).zoom)||1;
  summary.style.width=`${Math.max(300,window.innerWidth/zoom-28)}px`;
  summary.style.height=`${Math.max(300,window.innerHeight/zoom-28)}px`;
 }
 function syncNarrowWarning(){
  const narrow=window.matchMedia('(max-width:899px)').matches;
  if(narrowWidth)narrowWidth.textContent=String(window.innerWidth);
  if(narrowWarning)narrowWarning.hidden=!narrow;
  shell.classList.toggle('duel-too-narrow',narrow);
 }
 function summaryRows(){return summaryData?summaryData.rows.filter(row=>summaryFilter!=='wrong'||row.answers.some(answer=>!answer.correct)):[];}
 function renderSummaryOverview(){
  const rows=summaryRows();
  summary.querySelector('[data-summary-counts]').textContent=summaryData.wrongCount?`${summaryData.wrongCount} 题值得再讲一讲，其中 ${summaryData.bothWrongCount} 题双方未答对`:'两位全部答对！挑一道题，分享思考过程。';
  summary.querySelectorAll('[data-summary-filter]').forEach(button=>{const active=button.dataset.summaryFilter===summaryFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  summary.querySelector('.duel-summary-list').innerHTML=rows.length?rows.map(row=>`<button type="button" data-summary-source="${row.sourceId}" class="duel-summary-row ${row.sourceId===summarySource?'active':''}" aria-current="${row.sourceId===summarySource?'true':'false'}"><span class="duel-summary-topic"><b>${row.sourceId+1}</b><span>${escapeText(row.topic||`第 ${row.sourceId+1} 题`)}</span></span>${row.answers.map((answer,i)=>`<span data-summary-result="${i}" data-correct="${answer.correct}" class="${answer.correct?'summary-correct':'summary-discuss'}">${answer.timeout?'⌛ 超时':answer.correct?'✓ 答对':'× 答错'}</span>`).join('')}</button>`).join(''):'<div class="duel-summary-empty"><span aria-hidden="true">✓</span><strong>没有错题</strong><p>两位同学都完成得很好。切回“全部题目”，一起说说为什么。</p><button type="button" data-summary-filter="all">查看全部题目</button></div>';
 }
 function renderSummaryDetail(){
  const detail=summary.querySelector('.duel-summary-detail'),rows=summaryRows(),row=rows.find(item=>item.sourceId===summarySource);
  if(!row){detail.removeAttribute('data-summary-current');detail.innerHTML='<div class="duel-summary-empty duel-summary-empty-detail"><span aria-hidden="true">✦</span><h3>会做，也要会说</h3><p>没有需要重讲的错题。选择“全部题目”，请同学分享一种判断角度的方法。</p><button type="button" class="duel-primary" data-summary-filter="all">回看全部题目</button></div>';return;}
  detail.dataset.summaryCurrent=row.sourceId;
  const position=rows.findIndex(item=>item.sourceId===row.sourceId),revealed=summaryRevealed.has(row.sourceId);
  detail.innerHTML=`<div class="duel-summary-detail-scroll"><div class="duel-summary-question-heading"><span>第 ${row.sourceId+1} 题 · ${escapeText(row.topic||'角度与方向')}</span><h3>${escapeText(row.question)}</h3></div><div class="duel-summary-art">${typeof row.art==='function'?row.art():''}</div><div class="duel-summary-option-list" aria-label="本题选项">${row.options.map((option,i)=>`<span><b>${'ABCD'[i]}</b>${escapeText(option)}</span>`).join('')}</div><div class="duel-summary-students">${row.answers.map((answer,i)=>`<div class="duel-summary-student duel-summary-student-${i}" data-summary-player="${i}" data-correct="${answer.correct}"><div><span>${names[i]}</span><small>${answer.timeout?'⌛ 超时':answer.correct?'✓ 答对':'× 答错'}</small></div><strong>${escapeText(answer.selectedText)}</strong></div>`).join('')}</div><div class="duel-summary-think" ${revealed?'hidden':''}>先请全班想一想：你会怎么选？理由是什么？</div><div class="duel-summary-explanation" ${revealed?'':'hidden'}><strong>正确答案：${escapeText(row.correctAnswer)}</strong><p>${escapeText(row.explain)}</p></div></div><footer class="duel-summary-controls"><div class="duel-summary-step"><button type="button" data-summary-prev ${position===0?'disabled':''}>← 上一题</button><span>${position+1} / ${rows.length}</span><button type="button" data-summary-next ${position===rows.length-1?'disabled':''}>下一题 →</button></div><button type="button" class="duel-primary" data-summary-reveal aria-expanded="${revealed}">${revealed?'收起答案与讲解':'显示答案与讲解'}</button></footer>`;
 }
 function selectSummarySource(sourceId){
  if(!summaryRows().some(row=>row.sourceId===sourceId))return;
  summarySource=sourceId;renderSummaryOverview();renderSummaryDetail();
 }
 function showSummaryExplanation(){
  const scroll=summary.querySelector('.duel-summary-detail-scroll'),explanation=summary.querySelector('.duel-summary-explanation');
  if(!scroll||!explanation||explanation.hidden)return;
  const zoom=Number.parseFloat(getComputedStyle(document.body).zoom)||1;
  const clipped=explanation.getBoundingClientRect().bottom-scroll.getBoundingClientRect().bottom;
  if(clipped>0)scroll.scrollTop+=clipped/zoom+12;
 }
 function changeSummaryFilter(filter){
  summaryFilter=filter==='wrong'?'wrong':'all';
  const rows=summaryRows();
  if(!rows.some(row=>row.sourceId===summarySource))summarySource=rows.length?rows[0].sourceId:null;
  renderSummaryOverview();renderSummaryDetail();
 }
 function openSummary(){
  if(state.phase!=='result')return;
  if(!summaryData){
   summaryData=M.review(state);if(!summaryData)return;
   const priority=summaryData.rows.find(row=>row.answers.every(answer=>!answer.correct))||summaryData.rows.find(row=>row.answers.some(answer=>!answer.correct))||summaryData.rows[0];
   summarySource=priority?priority.sourceId:null;summaryFilter='all';
   const result=M.result(state),award=summary.querySelector('.duel-summary-award');
   award.dataset.winner=result.tie?'tie':result.winner;
   const allCorrect=result.scores.every(score=>score===questions.length);
   award.innerHTML=`<div class="duel-summary-trophy" aria-hidden="true">${result.tie?'✦':'🏆'}</div><div class="duel-summary-award-copy"><h3>${result.tie?(allCorrect?'全部答对，两位并列第一！':'同分并列，一起为思考鼓掌！'):`${names[result.winner]}获得本局冠军！`}</h3><p>${result.tie?(allCorrect?'会观察，也会判断。把你的好方法分享给大家吧。':'再把疑问讲明白，每一次修正都是进步。'):'为获胜同学鼓掌，也为两位的认真思考和勇敢尝试鼓掌。'}</p></div><div class="duel-summary-final-score"><span>左侧 <b>${result.scores[0]}</b></span><i>:</i><span><b>${result.scores[1]}</b> 右侧</span><small>按得分判定 · 同分并列</small></div>`;
  }
  fitSummary();renderSummaryOverview();renderSummaryDetail();
  if(!summary.open)summary.showModal();
 }
 function closeSummary(){summary.querySelectorAll('.duel-summary-confetti').forEach(node=>node.remove());if(summary.open)summary.close();}
 function onSummaryCancel(event){event.preventDefault();closeSummary();}
 function closeResult(){resultDialog.querySelectorAll('.duel-result-confetti').forEach(node=>node.remove());if(resultDialog.open)resultDialog.close();}
 function onResultCancel(event){event.preventDefault();closeResult();}
 function beginPlay(){
  countdownTimer=null;countdown.hidden=true;
  if(disposed||countdownPaused)return;
  if(!M.start(state,performance.now()).ok)return;
  renderQuestion(0);renderQuestion(1);syncControls();playSound('start');
 }
 function scheduleCountdown(){
  if(disposed||countdownPaused)return;
  countdown.hidden=false;countdown.querySelector('strong').textContent=countdownNumber;
  playSound('tick');
  countdownTimer=later(()=>{countdownTimer=null;countdownNumber--;if(countdownNumber<=0)beginPlay();else scheduleCountdown();},1000);
 }
 function setPaused(paused){
  const wasCountdown=state.phase==='countdown'||(state.phase==='paused'&&state.pausedFrom==='countdown');
  const result=paused?M.pause(state,performance.now()):M.resume(state,performance.now());
  if(!result.ok)return;
  if(wasCountdown){countdownPaused=paused;if(paused)clearCountdown();else scheduleCountdown();}
  syncControls();
 }
 function closeReview(i){panels[i].querySelector('.duel-review').hidden=true;stages[i].inert=false;}
 function showImage(i,qid){
  const q=M.current(state,i);if(!q||q.id!==qid)return;
  const image=panels[i].querySelector('.duel-image-view');
  image.innerHTML=`<div class="duel-review-heading"><h3>仔细观察</h3><button type="button" data-duel-image-close="${i}">返回答题</button></div><h4>${escapeText(q.q)}</h4><div class="duel-enlarged-art">${typeof q.art==='function'?q.art():''}</div><p>放大只影响自己这一侧，另一位同学可以继续答题。</p>`;
  image.hidden=false;stages[i].inert=true;
 }
 function closeImage(i){panels[i].querySelector('.duel-image-view').hidden=true;stages[i].inert=false;}
 function restart(){
  closeSummary();closeResult();summaryData=null;summarySource=null;summaryFilter='all';summaryRevealed.clear();resultShown=false;resultOpen.hidden=true;reviewOpen.hidden=true;
  summary.querySelector('.duel-summary-award').innerHTML='';summary.querySelector('.duel-summary-list').innerHTML='';summary.querySelector('.duel-summary-detail').innerHTML='';
  clearCountdown();for(const timer of timers)clearTimeout(timer);timers.clear();
  countdownNumber=3;countdownPaused=false;countdown.hidden=true;banner.hidden=true;pauseMask.hidden=true;
  M.restart(state);
  panels.forEach((panel,i)=>{panel.classList.remove('duel-winner','duel-score-pop');closeReview(i);closeImage(i);renderReady(i);});
  syncControls();
 }
 function onClick(event){
  const button=event.target.closest('button');if(!button||!host.contains(button)||button.disabled||disposed)return;
  if(button.id==='whole-class'||button.id==='duel-narrow-exit'){if(typeof onExit==='function')onExit();return;}
  if(button.id==='duel-result-open'){if(state.phase==='result')resultDialog.showModal();return;}
  if(button.id==='duel-review-open'){openSummary();return;}
  if(button.hasAttribute('data-result-close')){closeResult();return;}
  if(button.hasAttribute('data-result-review')){closeResult();openSummary();return;}
  if(button.hasAttribute('data-summary-close')){closeSummary();return;}
  if(button.hasAttribute('data-summary-filter')){changeSummaryFilter(button.dataset.summaryFilter);return;}
  if(button.hasAttribute('data-summary-source')){selectSummarySource(Number(button.dataset.summarySource));return;}
  if(button.hasAttribute('data-summary-reveal')){
   if(summarySource===null)return;
   if(summaryRevealed.has(summarySource))summaryRevealed.delete(summarySource);else summaryRevealed.add(summarySource);
   const revealed=summaryRevealed.has(summarySource);summary.querySelector('.duel-summary-explanation').hidden=!revealed;summary.querySelector('.duel-summary-think').hidden=revealed;button.textContent=revealed?'收起答案与讲解':'显示答案与讲解';button.setAttribute('aria-expanded',String(revealed));if(revealed)showSummaryExplanation();return;
  }
  if(button.hasAttribute('data-summary-prev')||button.hasAttribute('data-summary-next')){const rows=summaryRows(),position=rows.findIndex(row=>row.sourceId===summarySource),next=position+(button.hasAttribute('data-summary-prev')?-1:1);if(rows[next])selectSummarySource(rows[next].sourceId);return;}
  if(button.id==='duel-sound'){soundEnabled=!soundEnabled;button.textContent=`音效：${soundEnabled?'开':'关'}`;button.setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled){unlockSound();playSound('ready');}else{stopSounds();if(audio)audio.suspend().catch(()=>{});}return;}
  if(button.id==='duel-restart'){restart();return;}
  if(button.id==='duel-pause'){unlockSound();setPaused(!(state.phase==='paused'||countdownPaused));return;}
  if(button.hasAttribute('data-duel-resume')){unlockSound();setPaused(false);return;}
  if(button.hasAttribute('data-duel-ready')){
   unlockSound();const i=Number(button.dataset.duelReady),result=M.ready(state,i);if(!result.ok)return;
   renderReady(i);playSound('ready');syncControls();
   if(state.phase==='countdown'){countdownNumber=3;scheduleCountdown();}
   return;
  }
  if(button.hasAttribute('data-duel-answer')){
   const i=Number(button.dataset.player),result=M.answer(state,i,Number(button.dataset.duelAnswer),button.dataset.question,performance.now());if(!result.ok)return;
   if(result.timeout)applyTimeout(i,result);else applyAnswer(i,result);playSound('ready');syncControls();
   if(state.phase==='result')finishRound();
   return;
  }
  if(button.hasAttribute('data-duel-next')){const i=Number(button.dataset.duelNext);if(M.next(state,i,button.dataset.question,performance.now()).ok){renderQuestion(i);syncControls();}return;}
  if(button.hasAttribute('data-duel-image-open')){showImage(Number(button.dataset.duelImageOpen),button.dataset.question);return;}
  if(button.hasAttribute('data-duel-image-close')){closeImage(Number(button.dataset.duelImageClose));return;}
  if(button.hasAttribute('data-duel-review-close'))closeReview(Number(button.dataset.duelReviewClose));
 }
 function onVisibility(){if(document.hidden&&(state.phase==='playing'||state.phase==='countdown'))setPaused(true);}
 function onBlur(){if(state.phase==='playing'||state.phase==='countdown')setPaused(true);}
 function onResize(){fitSummary();syncNarrowWarning();}
 host.addEventListener('click',onClick);summary.addEventListener('cancel',onSummaryCancel);resultDialog.addEventListener('cancel',onResultCancel);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('blur',onBlur);window.addEventListener('resize',onResize);
 tickTimer=setInterval(()=>{if(!disposed&&state.phase==='playing'){updateQuestionTimer(0);updateQuestionTimer(1);updatePlayer(0);updatePlayer(1);}},200);
 renderReady(0);renderReady(1);syncControls();syncNarrowWarning();
 return {dispose(){if(disposed)return;disposed=true;closeSummary();closeResult();clearCountdown();for(const timer of timers)clearTimeout(timer);timers.clear();clearInterval(tickTimer);host.removeEventListener('click',onClick);summary.removeEventListener('cancel',onSummaryCancel);resultDialog.removeEventListener('cancel',onResultCancel);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('blur',onBlur);window.removeEventListener('resize',onResize);if(host.quizDuelState===state)delete host.quizDuelState;stopSounds();if(audio){try{audio.close().catch(()=>{});}catch(_error){}audio=null;}}};
};
})();
