(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.QuizDuelModel=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  // No browser clock or timers live here. The caller supplies one monotonic
  // millisecond clock (for example performance.now) to every timed action.
  function fail(reason){return {ok:false,reason};}
  function playerAt(state,index){return index===0||index===1?state.players[index]:null;}
  function shuffle(items,rng){
    const copy=items.slice();
    for(let i=copy.length-1;i>0;i--){
      const sample=Number(rng());
      const fraction=Number.isFinite(sample)?Math.max(0,Math.min(1-Number.EPSILON,sample)):0;
      const j=Math.floor(fraction*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }
  function distinctOrder(left,right){
    if(left.length<2)return right;
    const fixed=[];
    left.forEach((id,index)=>{if(right[index]===id)fixed.push(index);});
    if(fixed.length===1){
      const a=fixed[0],b=(a+1)%right.length;
      [right[a],right[b]]=[right[b],right[a]];
    }else if(fixed.length>1){
      const first=right[fixed[0]];
      for(let i=0;i<fixed.length-1;i++)right[fixed[i]]=right[fixed[i+1]];
      right[fixed[fixed.length-1]]=first;
    }
    return right;
  }
  function cards(state,order){
    return order.map(sourceId=>{
      const source=state._questions[sourceId];
      const choices=shuffle(source.options.map((text,index)=>({text,index})),state._rng);
      return {...source,id:'r'+state.round+'-q'+sourceId,sourceId,
        options:choices.map(choice=>choice.text),
        answer:choices.findIndex(choice=>choice.index===source.answer)};
    });
  }
  function reset(state){
    const ids=state._questions.map((_,i)=>i);
    const left=shuffle(ids,state._rng);
    const right=distinctOrder(left,shuffle(ids,state._rng));
    state.phase='ready';
    state.startedAt=null;
    state.pausedAt=null;
    state.pausedFrom=null;
    state.pausedMs=0;
    state.players=[left,right].map(order=>({
      ready:false,index:0,score:0,answered:false,selected:null,
      finished:false,finishedAt:null,elapsedMs:null,
      // Active elapsed time at which the current question began. Keeping this
      // in the model makes every question's deadline independent of pauses and
      // of the other student's progress.
      questionStartedElapsed:0,
      questions:cards(state,order),answers:[]
    }));
    return state;
  }
  function create(questions,options={}){
    if(!Array.isArray(questions)||questions.length===0)throw new TypeError('双人赛至少需要一道题。');
    questions.forEach(question=>{
      if(!question||!Array.isArray(question.options)||question.options.length<2||
        !Number.isInteger(question.answer)||question.answer<0||question.answer>=question.options.length)
        throw new TypeError('每道题需要至少两个选项和有效的正确答案下标。');
    });
    return reset({round:1,_questions:questions.map(question=>({...question,options:question.options.slice()})),
      _rng:typeof options.rng==='function'?options.rng:Math.random});
  }
  function current(state,index){
    const player=playerAt(state,index);
    return player?player.questions[player.index]||null:null;
  }
  function ready(state,index,value=true){
    const player=playerAt(state,index);
    if(!player)return fail('invalid-player');
    if(state.phase!=='ready')return fail('not-ready-phase');
    player.ready=Boolean(value);
    if(state.players.every(person=>person.ready))state.phase='countdown';
    return {ok:true,phase:state.phase};
  }
  function start(state,now){
    if(state.phase!=='countdown')return fail('not-countdown');
    if(!Number.isFinite(now))return fail('invalid-time');
    state.startedAt=now;
    state.phase='playing';
    state.players.forEach(player=>{player.questionStartedElapsed=0;});
    return {ok:true};
  }
  function questionLimit(question){
    const seconds=Number(question&&question.timeLimitSeconds);
    return (Number.isFinite(seconds)&&seconds>0?seconds:30)*1000;
  }
  function limit(state,index){return questionLimit(current(state,index));}
  function elapsed(state,index,now){
    const player=playerAt(state,index);
    if(!player||state.startedAt===null)return 0;
    if(player.finished)return player.elapsedMs;
    const end=state.phase==='paused'?state.pausedAt:now;
    if(!Number.isFinite(end))return 0;
    return Math.max(0,end-state.startedAt-state.pausedMs);
  }
  function answer(state,index,slot,expectedQuestionId,now){
    const player=playerAt(state,index),question=current(state,index);
    if(!player)return fail('invalid-player');
    if(state.phase!=='playing')return fail('not-playing');
    if(player.finished)return fail('finished');
    if(!question||question.id!==expectedQuestionId)return fail('stale-question');
    if(player.answered)return fail('already-answered');
    if(!Number.isInteger(slot)||slot<0||slot>=question.options.length)return fail('invalid-option');
    if(!Number.isFinite(now)||now<state.startedAt)return fail('invalid-time');
    if(remaining(state,index,now)<=0)return timeout(state,index,expectedQuestionId,now);
    const correct=slot===question.answer;
    player.answered=true;
    player.selected=slot;
    if(correct)player.score++;
    const duration=elapsed(state,index,now);
    player.answers.push({questionId:question.id,sourceId:question.sourceId,
      selected:slot,correct,timeout:false,answeredAt:now,elapsedMs:duration});
    if(player.index===player.questions.length-1){
      // Stop at the final choice; reading the final explanation takes no time.
      player.elapsedMs=duration;
      player.finishedAt=now;
      player.finished=true;
      if(state.players.every(person=>person.finished))state.phase='result';
    }
    return {ok:true,correct,selected:slot,question,finished:player.finished};
  }
  function next(state,index,expectedQuestionId,now){
    const player=playerAt(state,index),question=current(state,index);
    if(!player)return fail('invalid-player');
    if(state.phase!=='playing')return fail('not-playing');
    if(player.finished)return fail('finished');
    if(!question||question.id!==expectedQuestionId)return fail('stale-question');
    if(!player.answered)return fail('not-answered');
    if(!Number.isFinite(now)||now<state.startedAt)return fail('invalid-time');
    player.index++;
    player.answered=false;
    player.selected=null;
    player.questionStartedElapsed=elapsed(state,index,now);
    return {ok:true,question:current(state,index)};
  }
  function remaining(state,index,now){
    const player=playerAt(state,index),question=current(state,index);
    if(!player||!question||state.startedAt===null)return 0;
    const lastAnswer=player.answered?player.answers[player.answers.length-1]:null;
    if(lastAnswer&&lastAnswer.timeout)return 0;
    const currentElapsed=lastAnswer?lastAnswer.elapsedMs:elapsed(state,index,now);
    return Math.max(0,questionLimit(question)-(currentElapsed-player.questionStartedElapsed));
  }
  function timeout(state,index,expectedQuestionId,now){
    const player=playerAt(state,index),question=current(state,index);
    if(!player)return fail('invalid-player');
    if(state.phase!=='playing')return fail('not-playing');
    if(player.finished)return fail('finished');
    if(!question||question.id!==expectedQuestionId)return fail('stale-question');
    if(player.answered)return fail('already-answered');
    if(!Number.isFinite(now)||now<state.startedAt)return fail('invalid-time');
    if(remaining(state,index,now)>0)return fail('not-timeout');
    const duration=elapsed(state,index,now);
    player.answered=true;
    player.selected=null;
    player.answers.push({questionId:question.id,sourceId:question.sourceId,
      selected:null,correct:false,timeout:true,answeredAt:now,elapsedMs:duration});
    if(player.index===player.questions.length-1){
      player.elapsedMs=duration;
      player.finishedAt=now;
      player.finished=true;
      if(state.players.every(person=>person.finished))state.phase='result';
    }
    return {ok:true,correct:false,timeout:true,selected:null,question,finished:player.finished};
  }
  function pause(state,now){
    if(state.phase!=='playing'&&state.phase!=='countdown')return fail('not-playing');
    if(!Number.isFinite(now)||(state.startedAt!==null&&now<state.startedAt))return fail('invalid-time');
    state.pausedFrom=state.phase;
    state.pausedAt=now;
    state.phase='paused';
    return {ok:true};
  }
  function resume(state,now){
    if(state.phase!=='paused')return fail('not-paused');
    if(!Number.isFinite(now)||now<state.pausedAt)return fail('invalid-time');
    if(state.pausedFrom==='playing')state.pausedMs+=now-state.pausedAt;
    state.pausedAt=null;
    state.phase=state.pausedFrom;
    state.pausedFrom=null;
    return {ok:true};
  }
  function restart(state){
    state.round++;
    reset(state);
    return {ok:true};
  }
  function result(state){
    if(state.phase!=='result')return null;
    const scores=state.players.map(player=>player.score);
    const tie=scores[0]===scores[1];
    return {winner:tie?null:(scores[0]>scores[1]?0:1),tie,scores,
      elapsed:state.players.map(player=>player.elapsedMs)};
  }
  function review(state){
    if(state.phase!=='result')return null;
    // Align by source question, then decode each choice with that player's own
    // shuffled card. A displayed A/B/C/D or deck position is not a shared ID.
    const rows=state._questions.map((question,sourceId)=>({
      sourceId,topic:question.topic||`第 ${sourceId+1} 题`,question:question.q,
      options:question.options.slice(),correctAnswer:question.options[question.answer],
      explain:question.explain,art:question.art,
      answers:state.players.map(player=>{
        const position=player.questions.findIndex(card=>card.sourceId===sourceId);
        const card=player.questions[position];
        const answer=player.answers.find(item=>item.questionId===card.id);
        return {correct:Boolean(answer&&answer.correct),
          timeout:Boolean(answer&&answer.timeout),
          selectedText:answer?(answer.timeout?'超时未作答':card.options[answer.selected]):'未作答',position:position+1};
      })
    }));
    return {rows,wrongCount:rows.filter(row=>row.answers.some(answer=>!answer.correct)).length,
      bothWrongCount:rows.filter(row=>row.answers.every(answer=>!answer.correct)).length};
  }
  return {create,current,ready,start,answer,next,timeout,remaining,limit,pause,resume,restart,elapsed,result,review};
});
