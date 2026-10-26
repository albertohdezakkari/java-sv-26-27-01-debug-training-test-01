const APP = document.querySelector('#app');
const STORE = 'dbg01_attempt_v1';
const SECONDS = 60;
const TOTAL = 20;
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzX9MQXPhHhkcKA9idKifON05j1IbxJhKAvXIvdj_N3F7H1lsiTGbdzREomAnCnMn-l/exec';
const MODES = {
  test: {label:'Test', title:'Repaso guiado', file:'data/test-questions.json', style:'test', intro:'Ve pregunta a pregunta y recibe una explicación después de cada respuesta.'},
  challenge: {label:'Challenge', title:'Reto contrarreloj', file:'data/challenge-questions.json', style:'challenge', intro:'Responde las 20 preguntas seguidas. Verás la revisión cuando termine el intento.'}
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const letters = 'ABCD';
let bank = {}, state = null, timer = null, busy = false;
try { state = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { state = null; }
function save(){ try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} }
function shell(content, extra=''){
  APP.innerHTML = `<div class="shell ${extra}"><header class="mast"><div class="brand"><span class="brand-mark">J1</span><span>PROGRAMACIÓN · 1SI</span></div><span class="pill">JAVA DEBUG TRAINING · 01</span></header>${content}<footer>ENTRENAMIENTO DE CÓDIGO · 26 OCT 2026</footer></div>`;
}
function home(){
  clearInterval(timer); state=null; save();
  shell(`<section class="hero"><div class="eyebrow">Entrenamiento de depuración · 80 preguntas</div><h1>Lee el código.<br>Encuentra el fallo.</h1><p class="lead">Practica con las preguntas creadas en clase. Elige un modo y dedica un minuto a cada pregunta.</p></section>
  <section class="mode-grid" aria-label="Elige el modo">
    ${Object.entries(MODES).map(([key,m])=>`<article class="mode-card ${m.style}"><div class="mode-top"><span class="mode-icon">${key==='test'?'01':'02'}</span><span class="mode-label">${key==='test'?'CON FEEDBACK':'SIN PISTAS'}</span></div><h2>${m.title}</h2><p>${m.intro}</p><div class="mode-foot"><span class="mode-meta">20 preguntas · 60 s / pregunta</span><button class="btn" data-mode="${key}">Empezar →</button></div></article>`).join('')}
  </section><p class="footnote">Cada intento contiene 20 preguntas aleatorias de un banco de 80. El servidor corrige las respuestas y registra la nota sobre 10. Un acierto suma 0,5 puntos; los errores no restan.</p>
  ${resumeAvailable()?`<article class="mode-card resume-card"><div class="eyebrow">Intento en curso</div><p>Este navegador conserva un intento sin terminar.</p><button class="btn" id="resume">Continuar intento →</button></article>`:''}`);
  APP.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>identify(b.dataset.mode));
  const resume=APP.querySelector('#resume'); if(resume) resume.onclick=()=>{state=JSON.parse(localStorage.getItem(STORE));loadBank(state.mode).then(()=>renderQuestion());};
}
function resumeAvailable(){try{const s=JSON.parse(localStorage.getItem(STORE));return s&&['question','feedback','sending','result'].includes(s.phase)&&MODES[s.mode]&&Array.isArray(s.questions)&&s.questions.length===TOTAL;}catch{return false;}}
function normalizeName(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');}
function identify(mode){
  shell(`<section class="hero"><div class="eyebrow">${MODES[mode].label} · 20 preguntas</div><h1>¿Quién eres?</h1><p class="lead">Escribe el nombre y los apellidos que aparecen en Classroom. El resultado se guardará en el registro del grupo.</p></section><section class="panel identity-form"><label for="student">Nombre y apellidos</label><input id="student" type="text" autocomplete="name" maxlength="100" placeholder="Por ejemplo: Amanda Acevedo Lorenzo"><p class="help">Se asocia la nota a tu nombre del grupo 1SI. No necesitas correo electrónico.</p><button class="btn" id="begin">Continuar →</button><p id="identity-error" class="small-muted" role="alert"></p></section>`);
  APP.querySelector('#begin').onclick=()=>start(mode);
  APP.querySelector('#student').addEventListener('keydown',e=>{if(e.key==='Enter')start(mode);});
}
async function loadBank(mode){
  if(bank[mode])return bank[mode];
  const res=await fetch(MODES[mode].file,{cache:'no-store'}); if(!res.ok)throw new Error('No se ha podido cargar el banco.');
  const data=await res.json();
  if(data.questions.length!==80||data.quiz!==`1SI-JAVA-DEBUG-${mode.toUpperCase()}-01`)throw new Error('El banco del cuestionario no es válido.');
  bank[mode]=data;return data;
}
async function start(mode){
  const name=APP.querySelector('#student').value.trim();
  if(normalizeName(name).split(' ').length<2){APP.querySelector('#identity-error').textContent='Escribe tu nombre y al menos un apellido.';return;}
  const button=APP.querySelector('#begin');button.disabled=true;button.textContent='Preparando…';
  try{
    const data=await loadBank(mode), order=shuffle(data.questions.map((_,i)=>i)).slice(0,TOTAL);
    const questions=order.map(i=>data.questions[i]);
    state={phase:'question',mode,quiz:data.quiz,studentInput:name,attemptId:crypto.randomUUID(),startedAt:Date.now(),questions,index:0,answers:[],times:[],deadline:Date.now()+SECONDS*1000};save();renderQuestion();
  }catch(e){button.disabled=false;button.textContent='Continuar →';APP.querySelector('#identity-error').textContent=e.message;}
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function remaining(){return Math.max(0,Math.ceil((state.deadline-Date.now())/1000));}
function renderQuestion(){
  clearInterval(timer);
  if(!state||!MODES[state.mode])return home();
  if(state.phase==='result'||state.phase==='sending')return showResult();
  const m=MODES[state.mode],q=state.questions[state.index],locked=state.phase==='feedback', selected=state.answers[state.index];
  shell(`<header class="quiz-head"><div class="quiz-ident"><strong>${m.title}</strong><br>Nombre: ${esc(state.studentInput)}</div><span class="tag">${state.mode==='test'?'TEST':'CHALLENGE'}</span></header>
    <div class="progress-wrap" aria-label="Progreso"><div class="progress ${state.mode==='challenge'?'challenge-progress':''}" style="width:${state.index/TOTAL*100}%"></div></div>
    <section class="question-card"><div class="quiz-meta"><div class="meta-left"><span class="topic">${esc(q.topic.toUpperCase())}</span><br>PREGUNTA ${state.index+1} / ${TOTAL}</div><div class="timer ${remaining()<=10?'warn':''}" id="timer" role="timer" aria-label="Segundos restantes">01:${String(remaining()%60).padStart(2,'0')}</div></div>
    <h1 class="prompt">${esc(q.question)}</h1>${q.code?`<pre class="code"><code>${esc(q.code)}</code></pre>`:''}
    <div class="options">${q.options.map((o,i)=>`<button class="option ${locked&&i===q.answer?'correct':''} ${locked&&selected===i&&selected!==q.answer?'wrong':''} ${!locked&&selected===i?'selected':''}" data-choice="${i}" ${locked?'disabled':''}><span class="option-key">${letters[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    ${locked?`<div class="feedback ${selected===q.answer?'':'bad'}"><strong>${selected===q.answer?'✓ Correcto.':'✕ Revisa esta pregunta.'}</strong><p>Respuesta correcta: <b>${letters[q.answer]} · ${esc(q.options[q.answer])}</b><br>${esc(q.explanation)}</p></div>`:''}
    <div class="actions"><span class="small-muted">${state.mode==='test'?'La respuesta queda registrada al continuar.':'El resultado se mostrará al finalizar.'}</span>${locked?`<button class="btn" id="next">${state.index===TOTAL-1?'Ver resultado →':'Siguiente →'}</button>`:''}</div></section>`,state.mode);
  if(locked){APP.querySelector('#next').onclick=advance;return;}
  APP.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.choice)));
  updateTimer();timer=setInterval(updateTimer,200);
}
function updateTimer(){
  if(state?.phase!=='question')return;
  const s=remaining(),node=APP.querySelector('#timer');if(node){node.textContent=`00:${String(s).padStart(2,'0')}`;node.classList.toggle('warn',s<=10);}
  if(s===0)choose(null);
}
function choose(index){
  if(state?.phase!=='question')return;
  clearInterval(timer);const left=remaining(),q=state.questions[state.index];
  state.answers[state.index]=left===0?null:index;state.times[state.index]=SECONDS-left;
  state.frozen=`00:${String(left).padStart(2,'0')}`;
  state.phase=state.mode==='test'?'feedback':'question';
  if(state.mode==='challenge')advance();else{save();renderQuestion();}
}
function advance(){
  clearInterval(timer);if(state.index===TOTAL-1){state.phase='result';state.finishedAt=Date.now();save();showResult();return;}
  state.index++;state.deadline=Date.now()+SECONDS*1000;state.phase='question';save();renderQuestion();window.scrollTo(0,0);
}
function scoreLocal(){let correct=0,blank=0;state.answers.forEach((a,i)=>{if(a===null||a===undefined)blank++;else if(a===state.questions[i].answer)correct++;});return {correct,blank,wrong:TOTAL-correct-blank,grade:correct*0.5};}
function showResult(){
  clearInterval(timer);if(state.phase==='result'&&!state.result){state.result=scoreLocal();state.finishedAt=state.finishedAt||Date.now();save();}
  const local=state.result||scoreLocal(),server=state.registration?.status==='saved'?state.registration.result:null, confirmed=!!server;
  const grade=confirmed?Number(server.nota):local.grade;
  shell(`<section class="hero"><div class="eyebrow">${state.mode==='test'?'Repaso completado':'Challenge completado'}</div><h1>${confirmed?'Nota registrada.':'Tu resultado.'}</h1><p class="lead">${esc(state.studentInput)} · ${state.mode==='test'?'Test':'Challenge'} Java 1SI</p></section><section class="panel results"><div class="score-row"><div class="score">${grade.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}</div><span class="score-unit">/ 10</span></div><div class="stats"><div class="stat"><strong>${confirmed?server.aciertos:local.correct}</strong>Aciertos</div><div class="stat"><strong>${confirmed?server.errores:local.wrong}</strong>Errores</div><div class="stat"><strong>${confirmed?server.blanco:local.blank}</strong>Sin responder</div></div>
    <div class="results-note" id="register-status" role="status">${confirmed?'✓ Nota corregida por el servidor y guardada en el registro de 1SI.':state.registration?.status==='failed'?'No se ha confirmado el registro. Conservamos el intento para reintentar.':'Guardando la nota en el registro de 1SI…'}</div>
    <div class="actions"><span class="small-muted">Cada acierto suma 0,5 puntos. Las respuestas erróneas no restan.</span>${confirmed?'<button class="btn" id="home">Volver al inicio</button>':''}</div>
    ${state.mode==='challenge'||confirmed?`<section class="review"><h2>Revisión</h2>${state.questions.map((q,i)=>`<article class="review-item"><div class="eyebrow">${String(i+1).padStart(2,'0')} · ${esc(q.topic)}</div><h3>${esc(q.question)}</h3>${q.code?`<pre class="code"><code>${esc(q.code)}</code></pre>`:''}<p class="${state.answers[i]===q.answer?'correct-text':'wrong-text'}">Tu respuesta: ${state.answers[i]===null||state.answers[i]===undefined?'Sin responder':letters[state.answers[i]]+' · '+esc(q.options[state.answers[i]])}</p><p class="correct-text">Correcta: ${letters[q.answer]} · ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p></article>`).join('')}</section>`:''}
    ${state.registration?.status==='failed'?'<button class="btn" id="retry">Reintentar guardado</button>':''}`,state.mode);
  const homeButton=APP.querySelector('#home');if(homeButton)homeButton.onclick=home;
  const retry=APP.querySelector('#retry');if(retry)retry.onclick=submitResult;
  if(!confirmed&&state.registration?.status!=='failed')submitResult();
}
async function submitResult(){
  if(busy)return;busy=true;state.registration={status:'sending'};save();
  const status=APP.querySelector('#register-status');if(status)status.textContent='Guardando la nota de forma segura…';
  const payload={quiz:state.quiz,attemptId:state.attemptId,alumno:state.studentInput,grupo:'1SI-JAVA',tiempoTotal:Math.ceil((state.finishedAt-state.startedAt)/1000),respuestas:state.questions.map((q,i)=>({preguntaId:q.id,respuesta:state.answers[i]===null||state.answers[i]===undefined?'':letters[state.answers[i]],segundos:state.times[i]||0}))};
  let data;
  try{
    const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    data=await response.json();if(!response.ok||!data.ok)throw new Error(data?.error||'No se ha confirmado el registro.');
    const r=data.resultado;if(!r||r.attemptId!==state.attemptId||r.total!==TOTAL||!Number.isFinite(r.nota))throw new Error('El servidor devolvió un resultado incompleto.');
    state.registration={status:'saved',result:r};save();busy=false;showResult();
  }catch(e){state.registration={status:'failed',message:e.message};save();busy=false;showResult();const el=APP.querySelector('#register-status');if(el)el.innerHTML=`No se ha confirmado el registro: ${esc(e.message)}. Puedes reintentar el mismo envío sin duplicar la nota.`;}
}
window.addEventListener('storage',e=>{if(e.key===STORE&&e.newValue){try{state=JSON.parse(e.newValue);renderQuestion();}catch{}}});
if(resumeAvailable()){
  state=JSON.parse(localStorage.getItem(STORE));
  loadBank(state.mode).then(()=>{if(state.deadline&&state.phase==='question'&&remaining()===0)choose(null);else if(state.phase==='feedback')renderQuestion();else if(state.phase==='sending'||state.phase==='result')showResult();else renderQuestion();}).catch(()=>home());
}else home();
