'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const M=require('../app/duel-model.js');
const questions=Array.from({length:8},(_,i)=>({q:'题目 '+i,options:['选项 A '+i,'选项 B '+i,'选项 C '+i,'选项 D '+i],answer:i%4,art:()=>'<svg/>',explain:'解释 '+i}));
function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function playing(){const state=M.create(questions,{rng:seeded(42)});M.ready(state,0);M.ready(state,1);M.start(state,1000);return state;}
function choose(state,p,correct,now){const q=M.current(state,p);return M.answer(state,p,correct?q.answer:(q.answer+1)%q.options.length,q.id,now);}
function complete(state,p,correctCount,start=2000){
  let now=start;
  for(let i=0;i<questions.length;i++){
    assert.equal(choose(state,p,i<correctCount,now).ok,true);
    if(i<questions.length-1){assert.equal(M.next(state,p,M.current(state,p).id,now+10).ok,true);}
    now+=100;
  }
}

test('each player gets all eight source questions once, with no same-position questions',()=>{
  for(let seed=0;seed<100;seed++){
    const state=M.create(questions,{rng:seeded(seed)});
    for(const player of state.players)assert.deepEqual(player.questions.map(q=>q.sourceId).sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
    for(let i=0;i<8;i++)assert.notEqual(state.players[0].questions[i].sourceId,state.players[1].questions[i].sourceId);
  }
});
test('options are shuffled without losing answers or mutating the question bank',()=>{
  const before=questions.map(q=>q.options.slice());
  const state=M.create(questions,{rng:seeded(17)});
  let shuffled=false;
  for(const player of state.players)for(const q of player.questions){
    const source=questions[q.sourceId];
    assert.equal(q.options[q.answer],source.options[source.answer]);
    assert.deepEqual(q.options.slice().sort(),source.options.slice().sort());
    assert.equal(q.art,source.art);
    if(q.options.join()!==source.options.join())shuffled=true;
  }
  assert.equal(shuffled,true);
  assert.deepEqual(questions.map(q=>q.options),before);
});
test('countdown requires both ready and does not accept answers before the common start',()=>{
  const state=M.create(questions);
  assert.equal(M.start(state,0).ok,false);
  assert.equal(M.ready(state,0).phase,'ready');
  assert.equal(M.ready(state,0,false).ok,true);
  assert.equal(state.players[0].ready,false);
  M.ready(state,0);
  assert.equal(M.ready(state,1).phase,'countdown');
  assert.equal(choose(state,0,true,0).ok,false);
  assert.equal(M.elapsed(state,0,9999),0);
  assert.equal(M.start(state,1000).ok,true);
  assert.equal(M.start(state,2000).ok,false);
  assert.equal(M.elapsed(state,0,1100),100);
  assert.equal(M.elapsed(state,1,1100),100);
});
test('rapid repeated choices score exactly once and wrong answers cannot be corrected for points',()=>{
  const state=playing(),q=M.current(state,0);
  assert.equal(choose(state,0,true,1100).ok,true);
  for(let i=0;i<20;i++)assert.equal(M.answer(state,0,q.answer,q.id,1200).reason,'already-answered');
  assert.equal(state.players[0].score,1);
  assert.equal(state.players[0].answers.length,1);
  assert.equal(choose(state,1,false,1300).correct,false);
  assert.equal(choose(state,1,true,1400).ok,false);
  assert.equal(state.players[1].score,0);
});
test('left and right progress independently, and stale next/answer events do not skip questions',()=>{
  const state=playing(),old=M.current(state,0);
  assert.equal(M.next(state,0,old.id,1100).reason,'not-answered');
  choose(state,0,true,1200);
  assert.equal(M.next(state,0,old.id,1300).ok,true);
  assert.equal(state.players[0].index,1);
  assert.equal(state.players[1].index,0);
  assert.equal(state.players[1].answered,false);
  assert.equal(M.next(state,0,old.id,1400).reason,'stale-question');
  assert.equal(M.answer(state,0,old.answer,old.id,1400).reason,'stale-question');
  assert.equal(state.players[0].index,1);
  assert.equal(state.players[0].score,1);
});
test('pause freezes both clocks, rejects interactions, and resumed time excludes all pauses',()=>{
  const state=playing();
  assert.equal(M.pause(state,1500).ok,true);
  assert.equal(M.elapsed(state,0,9000),500);
  assert.equal(M.elapsed(state,1,9000),500);
  assert.equal(choose(state,0,true,1600).reason,'not-playing');
  assert.equal(M.next(state,0,M.current(state,0).id,1600).reason,'not-playing');
  assert.equal(M.pause(state,1700).ok,false);
  assert.equal(M.resume(state,4500).ok,true);
  assert.equal(M.elapsed(state,0,5000),1000);
  assert.equal(M.pause(state,5500).ok,true);
  assert.equal(M.resume(state,6000).ok,true);
  assert.equal(M.elapsed(state,1,6500),2000);
  assert.equal(choose(state,0,true,6500).ok,true);
});
test('countdown pause/resume preserves the pre-start phase and adds no play-time pause',()=>{
  const state=M.create(questions);
  M.ready(state,0);M.ready(state,1);
  assert.equal(M.pause(state,1000).ok,true);
  assert.equal(state.phase,'paused');
  assert.equal(state.pausedFrom,'countdown');
  assert.equal(M.start(state,1500).ok,false);
  assert.equal(M.elapsed(state,0,5000),0);
  assert.equal(M.resume(state,7000).ok,true);
  assert.equal(state.phase,'countdown');
  assert.equal(state.pausedMs,0);
  assert.equal(M.start(state,8000).ok,true);
  assert.equal(M.elapsed(state,0,9000),1000);
});
test('finishing one side stops its clock immediately and does not block the other side',()=>{
  const state=playing();
  complete(state,0,8);
  assert.equal(state.phase,'playing');
  assert.equal(state.players[0].finished,true);
  assert.equal(M.elapsed(state,0,10000),1700);
  assert.equal(M.next(state,0,M.current(state,0).id,10000).reason,'finished');
  assert.equal(M.pause(state,4000).ok,true);
  assert.equal(M.elapsed(state,0,10000),1700);
  assert.equal(M.resume(state,5000).ok,true);
  complete(state,1,7,6000);
  assert.equal(state.phase,'result');
  assert.deepEqual(M.result(state),{winner:0,tie:false,scores:[8,7],elapsed:[1700,4700]});
  assert.equal(M.elapsed(state,1,99999),4700);
});
test('equal scores tie regardless of unequal completion times',()=>{
  const state=playing();
  complete(state,0,5,2000);
  assert.equal(M.result(state),null);
  complete(state,1,5,5000);
  const result=M.result(state);
  assert.equal(result.tie,true);
  assert.equal(result.winner,null);
  assert.deepEqual(result.scores,[5,5]);
  assert.notEqual(result.elapsed[0],result.elapsed[1]);
});
test('restart clears scores/timers/readiness and rejects callbacks from earlier rounds',()=>{
  const state=playing(),old=M.current(state,0);
  choose(state,0,true,1200);
  const firstOrder=state.players[0].questions.map(q=>q.sourceId).join();
  assert.equal(M.restart(state).ok,true);
  assert.equal(state.round,2);
  assert.equal(state.phase,'ready');
  assert.equal(state.startedAt,null);
  for(const player of state.players){
    assert.equal(player.score,0);assert.equal(player.ready,false);assert.equal(player.index,0);
    assert.equal(player.answered,false);assert.equal(player.selected,null);assert.equal(player.answers.length,0);
  }
  assert.notEqual(state.players[0].questions.map(q=>q.sourceId).join(),firstOrder);
  M.ready(state,0);M.ready(state,1);M.start(state,3000);
  assert.equal(M.answer(state,0,old.answer,old.id,3100).reason,'stale-question');
});
test('constant and extreme random sources terminate with valid question and option permutations',()=>{
  for(const sample of [0,1,-1,NaN,Infinity]){
    const state=M.create(questions,{rng:()=>sample});
    assert.equal(state.players[0].questions.length,8);
    for(let i=0;i<8;i++)assert.notEqual(state.players[0].questions[i].sourceId,state.players[1].questions[i].sourceId);
    for(const player of state.players)for(const q of player.questions)assert.equal(q.options[q.answer],questions[q.sourceId].options[questions[q.sourceId].answer]);
  }
});
test('invalid inputs fail without consuming an attempt, and a one-question bank can finish',()=>{
  assert.throws(()=>M.create([]));
  assert.throws(()=>M.create([{options:['A','B'],answer:3}]));
  const state=playing(),q=M.current(state,0);
  for(const slot of [-1,4,NaN,0.5])assert.equal(M.answer(state,0,slot,q.id,1500).reason,'invalid-option');
  assert.equal(M.answer(state,2,0,q.id,1500).reason,'invalid-player');
  assert.equal(M.answer(state,0,0,q.id,NaN).reason,'invalid-time');
  assert.equal(state.players[0].answered,false);
  const short=M.create([questions[0]],{rng:()=>0});M.ready(short,0);M.ready(short,1);M.start(short,0);
  choose(short,0,true,100);choose(short,1,false,200);
  assert.equal(short.phase,'result');assert.equal(M.result(short).winner,0);
});

test('classroom review waits for both students and clears when a new round starts',()=>{
  const state=playing();
  assert.equal(M.review(state),null);
  complete(state,0,8);
  assert.equal(M.review(state),null);
  complete(state,1,8,5000);
  assert.equal(M.review(state).wrongCount,0);
  assert.equal(M.review(state).bothWrongCount,0);
  M.restart(state);
  assert.equal(M.review(state),null);
});
test('review aligns all question and choice permutations, including different wrong choices',()=>{
  for(let seed=0;seed<50;seed++){
    const state=M.create(questions,{rng:seeded(seed)}),expected=[new Map(),new Map()];
    M.ready(state,0);M.ready(state,1);M.start(state,1000);
    for(let player=0;player<2;player++)for(let index=0;index<questions.length;index++){
      const card=M.current(state,player),source=questions[card.sourceId];
      // Sources 0,4: both wrong; 1,5: left wrong; 2,6: right wrong; 3,7: both right.
      const correct=card.sourceId%4===3||card.sourceId%4===(player===0?2:1);
      const selectedText=source.options[correct?source.answer:(source.answer+player+1)%4];
      expected[player].set(card.sourceId,{correct,timeout:false,selectedText,position:index+1});
      assert.equal(M.answer(state,player,card.options.indexOf(selectedText),card.id,2000+player*2000+index*100).ok,true);
      if(index<questions.length-1)M.next(state,player,card.id,2010+player*2000+index*100);
    }
    const summary=M.review(state);
    assert.deepEqual(summary.rows.map(row=>row.sourceId),[0,1,2,3,4,5,6,7]);
    assert.equal(summary.wrongCount,6);
    assert.equal(summary.bothWrongCount,2);
    for(const row of summary.rows){
      assert.equal(row.question,questions[row.sourceId].q);
      assert.equal(row.correctAnswer,questions[row.sourceId].options[questions[row.sourceId].answer]);
      assert.equal(row.art,questions[row.sourceId].art);
      assert.equal(row.explain,questions[row.sourceId].explain);
      for(let player=0;player<2;player++)assert.deepEqual(row.answers[player],expected[player].get(row.sourceId));
    }
    summary.rows[0].options[0]='changed';summary.rows[0].answers[0].selectedText='changed';
    assert.notEqual(M.review(state).rows[0].options[0],'changed');
    assert.notEqual(M.review(state).rows[0].answers[0].selectedText,'changed');
  }
});

test('each source carries its own limit, and each new question starts a full independent countdown',()=>{
  const bank=questions.map((q,i)=>({...q,timeLimitSeconds:15+i*5}));
  const s=M.create(bank,{rng:seeded(42)});M.ready(s,0);M.ready(s,1);M.start(s,1000);
  const first=M.current(s,0),other=M.current(s,1),limit=first.timeLimitSeconds*1000;
  assert.equal(M.limit(s,0),limit);
  assert.equal(M.remaining(s,0,1000),limit);
  assert.equal(M.remaining(s,0,5000),limit-4000);
  assert.equal(M.answer(s,0,first.answer,first.id,5000).correct,true);
  assert.equal(M.remaining(s,0,9999),limit-4000,'submitted answers freeze their own display');
  assert.equal(M.remaining(s,1,9999),other.timeLimitSeconds*1000-8999,'other side keeps counting');
  M.next(s,0,first.id,10000);
  assert.equal(M.remaining(s,0,10000),M.current(s,0).timeLimitSeconds*1000);
  assert.equal(M.remaining(s,0,10500),M.current(s,0).timeLimitSeconds*1000-500);
});

test('deadline and late clicks score zero even before a timer callback, and timeout is recorded once',()=>{
  for(const delta of [0,1,5000]){
    const s=playing(),q=M.current(s,0),deadline=1000+M.limit(s,0);
    assert.equal(M.timeout(s,0,q.id,deadline-1).reason,'not-timeout');
    const outcome=M.answer(s,0,q.answer,q.id,deadline+delta);
    assert.equal(outcome.ok,true);assert.equal(outcome.timeout,true);
    assert.equal(s.players[0].score,0);assert.equal(s.players[0].selected,null);
    assert.equal(s.players[0].answers.length,1);assert.equal(s.players[0].answers[0].timeout,true);
    assert.equal(M.timeout(s,0,q.id,deadline+delta).reason,'already-answered');
    assert.equal(M.answer(s,0,q.answer,q.id,deadline+delta).reason,'already-answered');
    assert.equal(M.remaining(s,0,deadline+delta),0);
    M.next(s,0,q.id,deadline+delta+1);
    assert.equal(M.timeout(s,0,q.id,deadline+delta+2).reason,'stale-question');
    assert.equal(s.players[0].answers.length,1);
  }
  const s=playing(),q=M.current(s,0);
  assert.equal(M.answer(s,0,q.answer,q.id,1000+M.limit(s,0)-1).correct,true);
});

test('per-question deadlines exclude repeated pauses including a pause immediately before zero',()=>{
  const s=playing(),q=M.current(s,0),limit=M.limit(s,0);
  M.pause(s,5000);
  assert.equal(M.remaining(s,0,500000),limit-4000);
  assert.equal(M.timeout(s,0,q.id,500000).reason,'not-playing');
  M.resume(s,25000);
  assert.equal(M.remaining(s,0,27000),limit-6000);
  M.pause(s,1000+limit+20000-1);
  assert.equal(M.remaining(s,0,999999),1);
  M.resume(s,200000);
  assert.equal(M.remaining(s,0,200000),1);
  assert.equal(M.timeout(s,0,q.id,200001).ok,true);
  assert.equal(s.players[0].score,0);
});

test('all timeouts finish only after both final questions, review differentiates timeout from an incorrect choice',()=>{
  const s=M.create(questions.slice(0,2).map(q=>({...q,timeLimitSeconds:15})),{rng:seeded(10)});
  M.ready(s,0);M.ready(s,1);M.start(s,1000);
  for(let player=0;player<2;player++){
    let now=16000;
    const q=M.current(s,player);
    M.timeout(s,player,q.id,now);M.next(s,player,q.id,now);
    const last=M.current(s,player);
    if(player===0)M.answer(s,player,(last.answer+1)%4,last.id,now+1);
    else M.timeout(s,player,last.id,now+15000);
    if(player===0){assert.equal(s.phase,'playing');assert.equal(M.result(s),null);assert.equal(M.review(s),null);}
  }
  assert.equal(s.phase,'result');assert.equal(M.result(s).tie,true);
  const review=M.review(s),entries=review.rows.flatMap(row=>row.answers);
  assert.equal(entries.filter(a=>a.timeout).length,3);
  assert.ok(entries.filter(a=>a.timeout).every(a=>a.selectedText==='超时未作答'&&!a.correct));
  assert.equal(entries.filter(a=>!a.timeout&&!a.correct).length,1);
  assert.equal(review.bothWrongCount,2);
  const old=M.current(s,1);M.restart(s);M.ready(s,0);M.ready(s,1);M.start(s,50000);
  assert.equal(M.timeout(s,1,old.id,65000).reason,'stale-question');
  assert.equal(s.players[1].answers.length,0);
});
