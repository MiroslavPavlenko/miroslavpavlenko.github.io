(function(){
  "use strict";
  const DATA=window.STUDY_DATA;
  let lang=localStorage.getItem('waDriverLang')||'en';
  const $=s=>document.querySelector(s);
  const txt=o=>typeof o==='string'?o:(o?.[lang]??o?.en??'');
  const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const KEYS=['A','B','C','D','E','F'];
  const UI={
    en:{kicker:'WASHINGTON · DRIVER LICENSE · STUDY DECK',title:'Washington Driver License — Study Deck',sub:'Built from the official Washington Driver Guide. Switch English / Español at any time without losing your place.',quiz:'Quiz',flash:'Flashcards',match:'Match',all:'All',shuffle:'↺ Shuffle',score:'Score',question:'Question',of:'of',mc:'Multiple choice',correct:'Correct',notquite:'Not quite',next:'Next →',restart:'Restart set',review:'Review missed',known:'Mark known →',knownYes:'Known ✓',reset:'↺ Reset deck',card:'Card',knownCount:'known',flipFront:'tap card or press space to flip',flipBack:'tap to flip back',definition:'Definition',matched:'Matched',moves:'Moves',cleared:'Set cleared',flawless:'flawless run',replay:'Shuffle & replay',nextSet:'Next set →',footer:'Official-source study aid',footerSub:'Questions and explanations are based on the provided Washington Driver Guide. Always follow current signs, laws, and DOL guidance.',tiers:[['Locked in','Excellent run. Review the few misses, then shuffle and retake.'],['Solid','Strong grasp. Drill the sections you slipped on below.'],['Getting there','Use flashcards and match mode, then retake the quiz.'],['Keep drilling','Work through flashcards and matching first, then try again.']]},
    es:{kicker:'WASHINGTON · LICENCIA DE CONDUCIR · GUÍA DE ESTUDIO',title:'Licencia de conducir de Washington — Guía de estudio',sub:'Creado a partir de la Guía del Conductor de Washington oficial. Cambie entre English / Español en cualquier momento sin perder su lugar.',quiz:'Cuestionario',flash:'Tarjetas',match:'Emparejar',all:'Todo',shuffle:'↺ Mezclar',score:'Puntuación',question:'Pregunta',of:'de',mc:'Opción múltiple',correct:'Correcto',notquite:'No exactamente',next:'Siguiente →',restart:'Reiniciar',review:'Repasar errores',known:'Marcar aprendida →',knownYes:'Aprendida ✓',reset:'↺ Reiniciar tarjetas',card:'Tarjeta',knownCount:'aprendidas',flipFront:'toque la tarjeta o presione espacio para voltear',flipBack:'toque para volver',definition:'Definición',matched:'Emparejadas',moves:'Movimientos',cleared:'Serie completada',flawless:'sin errores',replay:'Mezclar y repetir',nextSet:'Siguiente serie →',footer:'Ayuda de estudio basada en fuente oficial',footerSub:'Las preguntas y explicaciones se basan en la Guía del Conductor de Washington proporcionada. Siga siempre las señales, leyes y orientación actual del DOL.',tiers:[['Dominado','Excelente resultado. Repase los pocos errores y vuelva a intentarlo.'],['Sólido','Buen dominio. Practique las secciones donde falló.'],['Va mejorando','Use las tarjetas y el modo de emparejar, luego repita el cuestionario.'],['Siga practicando','Repase tarjetas y emparejamiento primero, luego inténtelo de nuevo.']]}
  };
  const secMap=()=>Object.fromEntries(DATA.meta.sections.map(s=>[s.id,txt(s.label)]));
  const secLabel=id=>secMap()[id]||'';

  let currentMode='quiz';
  let chFilter='all',list=[],qi=0,score=0,answered=false,results=[],reviewSet=null;
  let flashInit=false,deck=[],fi=0,flipped=false,known=new Set();
  let matchInit=false,setIdx=0,selKey=null,locked=new Set(),moves=0,busy=false;
  const fcCard=$('#fc-card');

  function applyLanguage(){
    document.documentElement.lang=lang==='en'?'en':'es';
    document.querySelectorAll('.lang-btn').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===lang?'true':'false'));
    const u=UI[lang];
    $('#kicker-text').textContent=u.kicker; $('#deck-title').textContent=u.title; $('#deck-sub').textContent=u.sub;
    $('#tab-quiz').textContent=u.quiz; $('#tab-flash').textContent=u.flash; $('#tab-match').textContent=u.match;
    $('#shuffle-btn').textContent=u.shuffle; $('#score-label').textContent=u.score; $('#fc-reset').textContent=u.reset;
    $('#matched-label').textContent=u.matched; $('#moves-label').textContent=u.moves; $('#def-label').textContent=u.definition;
    $('#fc-front-hint').textContent=u.flipFront; $('#fc-back-hint').textContent=u.flipBack;
    $('#foot-text').textContent=u.footer; $('#foot-sub').textContent=u.footerSub;
    renderPills();
    if(currentMode==='quiz') renderQuiz();
    if(currentMode==='flash' && flashInit) renderFlash();
    if(currentMode==='match' && matchInit) initMatch(true);
  }

  document.querySelectorAll('.lang-btn').forEach(b=>b.addEventListener('click',()=>{
    lang=b.dataset.lang;localStorage.setItem('waDriverLang',lang);applyLanguage();
  }));

  const sections={quiz:$('#quiz-mode'),flash:$('#flash-mode'),match:$('#match-mode')};
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
    currentMode=t.dataset.mode;
    document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===t?'true':'false'));
    Object.entries(sections).forEach(([k,el])=>el.classList.toggle('hidden',k!==currentMode));
    if(currentMode==='flash'&&!flashInit){initFlash();flashInit=true;}
    if(currentMode==='match'&&!matchInit){initMatch();matchInit=true;}
  }));

  function renderPills(){
    const u=UI[lang];let h=`<button class="pill" data-ch="all" aria-pressed="${chFilter==='all'}">${u.all}</button>`;
    DATA.meta.sections.forEach(s=>h+=`<button class="pill" data-ch="${s.id}" aria-pressed="${chFilter===s.id}">${txt(s.short)}</button>`);
    $('#ch-pills').innerHTML=h;
    $('#ch-pills').querySelectorAll('.pill').forEach(p=>p.addEventListener('click',()=>{chFilter=p.dataset.ch;buildQuiz(false);}));
  }
  function pool(){let a=DATA.quiz.slice();if(chFilter!=='all')a=a.filter(x=>x.sec===chFilter);return a;}
  function buildQuiz(fromReview=false){
    list=fromReview?reviewSet:shuffle(pool()); qi=0;score=0;answered=false;results=[];reviewSet=null;
    $('#results-slot').classList.add('hidden');$('#quiz-live').classList.remove('hidden');renderPills();renderQuiz();
  }
  function renderBar(){const b=$('#qbar');b.innerHTML='';list.forEach((_,i)=>{const s=document.createElement('div');s.className='seg'+(i<qi?' done':(i===qi?' cur':''));b.appendChild(s);});}
  function renderQuiz(){
    if(!list.length){$('#card-slot').innerHTML='';return;}
    if(qi>=list.length)return renderResults();
    const it=list[qi],u=UI[lang];
    $('#qcount').textContent=`${u.question} ${qi+1} ${u.of} ${list.length}`;$('#qscore').textContent=score;$('#qtotal').textContent=list.length;renderBar();
    const slot=$('#card-slot');
    let html=`<div class="card"><div class="tagstrip"><span>${secLabel(it.sec)}</span><span class="sep">/</span><span>${it.tag}</span><span class="ttype">${u.mc}</span></div><p class="q">${txt(it.q)}</p><div class="opts">`;
    txt(it.o).forEach((opt,i)=>html+=`<button class="opt" data-i="${i}"><span class="key">${KEYS[i]}</span><span>${opt}</span><span class="mark"></span></button>`);
    html+=`</div><div id="explain-wrap"></div><div class="foot ${answered?'':'hidden'}" id="mc-foot"><button class="btn primary" id="next-btn">${u.next}</button></div></div>`;
    slot.innerHTML=html;
    if(answered){
      const last=results[results.length-1],chosen=last.chosen,correct=last.correct;
      slot.querySelectorAll('.opt').forEach(b=>{const bi=+b.dataset.i;b.disabled=true;if(bi===it.a){b.classList.add('correct');b.querySelector('.mark').textContent=u.correct;}if(bi===chosen&&!correct){b.classList.add('wrong');b.querySelector('.mark').textContent='×';}});
      $('#explain-wrap').innerHTML=`<div class="explain ${correct?'ok':'no'}"><div class="verdict">${correct?u.correct:u.notquite}</div><div>${txt(it.x)}</div><div class="src">${it.s}</div></div>`;
    } else {
      slot.querySelectorAll('.opt').forEach(btn=>btn.addEventListener('click',()=>answerQuiz(+btn.dataset.i)));
    }
    const nb=$('#next-btn');if(nb)nb.addEventListener('click',()=>{qi++;answered=false;renderQuiz();});
  }
  function answerQuiz(chosen){
    if(answered)return;answered=true;const it=list[qi],correct=chosen===it.a;if(correct)score++;results.push({it,correct,chosen});renderQuiz();
  }
  function renderResults(){
    $('#quiz-live').classList.add('hidden');const u=UI[lang],total=list.length,pct=total?Math.round(score/total*100):0,by={};
    results.forEach(r=>{by[r.it.sec]??={c:0,t:0};by[r.it.sec].t++;if(r.correct)by[r.it.sec].c++;});
    const idx=pct>=90?0:pct>=75?1:pct>=55?2:3,[tier,msg]=u.tiers[idx];
    let bd='';Object.entries(by).forEach(([c,o])=>{const p=Math.round(o.c/o.t*100);bd+=`<div class="bd"><div class="ch">${secLabel(c)}</div><div class="val">${o.c}/${o.t}</div><div class="mini-bar"><i style="width:${p}%"></i></div></div>`;});
    const missed=results.filter(r=>!r.correct);
    $('#results-slot').innerHTML=`<div class="results"><div class="rscore">${pct}%</div><div class="rlabel">${score} / ${total}</div><div class="rtier">${tier}</div><p class="rmsg">${msg}</p><div class="breakdown">${bd}</div><div class="rbtns"><button class="btn primary" id="restart-btn">${u.restart}</button>${missed.length?`<button class="btn line" id="review-btn">${u.review} (${missed.length})</button>`:''}</div></div>`;
    $('#results-slot').classList.remove('hidden');$('#restart-btn').onclick=()=>buildQuiz(false);if(missed.length)$('#review-btn').onclick=()=>{reviewSet=shuffle(missed.map(r=>r.it));buildQuiz(true);};
  }
  $('#shuffle-btn').addEventListener('click',()=>buildQuiz(false));

  function initFlash(){deck=shuffle(DATA.flash);fi=0;known=new Set();renderFlash();}
  function renderFlash(){
    if(!deck.length)return;const c=deck[fi],u=UI[lang];flipped=false;fcCard.classList.remove('flip');
    $('#fc-tag').innerHTML=`<span>${secLabel(c.sec)}</span><span class="sep">/</span><span>${u.card}</span>`;
    $('#fc-term').textContent=txt(c.term);$('#fc-def').textContent=txt(c.def);$('#fc-count').innerHTML=`${u.card} ${fi+1} / ${deck.length} · <b>${known.size}</b> ${u.knownCount}`;
    $('#fc-known-btn').textContent=known.has(fi)?u.knownYes:u.known;$('#fc-known-btn').style.opacity=known.has(fi)?'.5':'1';
  }
  function flip(){flipped=!flipped;fcCard.classList.toggle('flip',flipped);}
  fcCard.addEventListener('click',flip);$('#fc-next').onclick=()=>{fi=(fi+1)%deck.length;renderFlash();};$('#fc-prev').onclick=()=>{fi=(fi-1+deck.length)%deck.length;renderFlash();};
  $('#fc-known-btn').onclick=()=>{known.has(fi)?known.delete(fi):known.add(fi);if(known.has(fi)&&deck.length>1)fi=(fi+1)%deck.length;renderFlash();};$('#fc-reset').onclick=initFlash;
  document.addEventListener('keydown',e=>{if(currentMode!=='flash')return;if(e.code==='Space'){e.preventDefault();flip();}else if(e.code==='ArrowRight')$('#fc-next').click();else if(e.code==='ArrowLeft')$('#fc-prev').click();});

  function initMatch(preserve=false){
    const wrap=$('#set-pills');wrap.innerHTML='';DATA.match.forEach((s,i)=>{const b=document.createElement('button');b.className='pill';b.textContent=txt(s.title);b.setAttribute('aria-pressed',i===setIdx?'true':'false');b.onclick=()=>{setIdx=i;renderMatch();initMatch(true);};wrap.appendChild(b);});
    if(!preserve||!$('#board').children.length)renderMatch();else renderMatch();
  }
  function renderMatch(){
    selKey=null;locked=new Set();moves=0;busy=false;$('#win-slot').innerHTML='';const set=DATA.match[setIdx],pairs=set.pairs,u=UI[lang];
    $('#m-total').textContent=pairs.length;$('#m-matched').textContent=0;$('#m-moves').textContent=0;
    const terms=shuffle(pairs.map((p,i)=>({k:i,t:txt(p[0])}))),defs=shuffle(pairs.map((p,i)=>({k:i,d:txt(p[1])})));
    let h='<div class="col terms">';terms.forEach(o=>h+=`<button class="mtile term" data-side="t" data-k="${o.k}">${o.t}</button>`);h+='</div><div class="col defs">';defs.forEach(o=>h+=`<button class="mtile" data-side="d" data-k="${o.k}">${o.d}</button>`);h+='</div>';
    $('#board').innerHTML=h;$('#board').querySelectorAll('.mtile').forEach(t=>t.onclick=()=>onTile(t));
  }
  function onTile(t){
    if(busy||t.classList.contains('locked'))return;const side=t.dataset.side,k=+t.dataset.k;
    if(side==='t'){document.querySelectorAll('.mtile.term.sel').forEach(x=>x.classList.remove('sel'));if(selKey===k){selKey=null;return;}selKey=k;t.classList.add('sel');return;}
    if(selKey===null){t.classList.add('bad');setTimeout(()=>t.classList.remove('bad'),300);return;}
    moves++;$('#m-moves').textContent=moves;const termBtn=document.querySelector(`.mtile.term[data-k="${selKey}"]`);
    if(k===selKey){termBtn.classList.remove('sel');termBtn.classList.add('locked');termBtn.disabled=true;t.classList.add('locked');t.disabled=true;locked.add(k);selKey=null;$('#m-matched').textContent=locked.size;if(locked.size===DATA.match[setIdx].pairs.length)winMatch();}
    else{busy=true;t.classList.add('bad');termBtn.classList.add('bad');setTimeout(()=>{t.classList.remove('bad');termBtn.classList.remove('bad','sel');selKey=null;busy=false;},380);}
  }
  function winMatch(){const u=UI[lang],perfect=moves===DATA.match[setIdx].pairs.length,next=(setIdx+1)%DATA.match.length;$('#win-slot').innerHTML=`<div class="win"><div class="h">${u.cleared}</div><div class="p">${moves} ${u.moves.toLowerCase()}${perfect?' · '+u.flawless:''}</div><div class="rbtns"><button class="btn line" id="replay-btn">${u.replay}</button><button class="btn primary" id="nextset-btn">${u.nextSet}</button></div></div>`;$('#replay-btn').onclick=renderMatch;$('#nextset-btn').onclick=()=>{setIdx=next;initMatch();};}

  applyLanguage();buildQuiz(false);
})();
