// ════════════════════════════════════════════════════════
//  PLAYBACK
// ════════════════════════════════════════════════════════
function parseDur(s){s=(s||'3:30').trim();const p=s.split(':');if(p.length===2)return Math.max(1,parseInt(p[0]||0)*60+parseInt(p[1]||0));return Math.max(1,parseFloat(s)*60||210);}
function fmt(sec){sec=Math.max(0,Math.round(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
function resetProg(){document.getElementById('prog-fill').style.width='0%';document.getElementById('pb-el').textContent='0:00';document.getElementById('pb-rem').textContent='';}
function updateProg(pct,dur){pct=Math.max(0,Math.min(1,pct));document.getElementById('prog-fill').style.width=(pct*100).toFixed(1)+'%';document.getElementById('pb-el').textContent=fmt(pct*dur);document.getElementById('pb-rem').textContent='-'+fmt((1-pct)*dur);}
function togglePlay(){playing?pausePlay():startPlay();}
function startPlay(){
  const body=document.getElementById('song-body');if(!body)return;
  const total=body.scrollHeight-body.clientHeight;if(total<10)return;
  const dur=parseDur(document.getElementById('dur-in').value);
  if(body.scrollTop>=total-4)body.scrollTop=playStartY;
  const curY=body.scrollTop,frac=curY/total,timeLeft=Math.max(0.5,dur*(1-frac));
  ps={startTime:performance.now(),startScroll:curY,totalScroll:total,durSec:dur,speed:(total-curY)/timeLeft,startSec:curElapsedSec};
  playing=true;
  const btn=document.getElementById('play-btn');
  btn.textContent='⏸';
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  btn.style.animationDuration=(60/bpm)+'s';
  btn.classList.add('beating');
  buildTimedEls();
  if(songTimelineSec>0) highlightNowPlaying(ps.startSec);
  if(tickEnabled) startTickScheduler();
  if(beatSoundEnabled) startBeatScheduler();
  if(rafId)cancelAnimationFrame(rafId);rafId=requestAnimationFrame(rafLoop);
}
function pausePlay(){
  playing=false;if(rafId){cancelAnimationFrame(rafId);rafId=null;}
  const btn=document.getElementById('play-btn');
  btn.textContent='▶';btn.classList.remove('beating');
  stopTickScheduler();
  stopBeatScheduler();
}
function stopPlay(){
  pausePlay();
  const body=document.getElementById('song-body');if(body)body.scrollTop=playStartY;
  ps=null;curElapsedSec=playStartSec;resetProg();
  // Destaque só aparece com um bloco selecionado (marcado) ou tocando — parar
  // sem marcador nenhum não deve deixar nenhuma linha destacada.
  if(document.querySelector('.play-start-marker')&&songTimelineSec>0){
    buildTimedEls();highlightNowPlaying(playStartSec);
  }else{
    clearNowPlaying();
  }
}

// ── Marcar de onde o play deve começar (ex: ensaiar um bloco específico) ──
// playStartSec vem do próprio data-t0 do elemento (a real linha do tempo por
// BPM/compasso/compassos), não de uma estimativa por posição de pixel.
function setPlayStart(el){
  const body=document.getElementById('song-body');if(!body)return;
  const already=el.classList.contains('play-start-marker');
  document.querySelectorAll('.sheet-section-hd.play-start-marker').forEach(e=>e.classList.remove('play-start-marker'));
  if(already){
    playStartY=0;playStartSec=0;curElapsedSec=0;
    if(!playing){body.scrollTop=0;clearNowPlaying();}
    return;
  }
  el.classList.add('play-start-marker');
  const rect=el.getBoundingClientRect(),bodyRect=body.getBoundingClientRect();
  const titleH=document.querySelector('.sheet-title')?.offsetHeight||300;
  playStartY=Math.max(0,body.scrollTop+(rect.top-bodyRect.top)-titleH);
  playStartSec=el.dataset.t0?+el.dataset.t0:0;
  curElapsedSec=playStartSec;
  if(!playing){
    body.scrollTop=playStartY;
    if(songTimelineSec>0){buildTimedEls();highlightNowPlaying(playStartSec);}
  }
}
function rafLoop(now){
  if(!playing||!ps)return;
  const body=document.getElementById('song-body');if(!body){playing=false;return;}
  const elapsed=(now-ps.startTime)/1000,newY=ps.startScroll+ps.speed*elapsed;
  const frac=newY/ps.totalScroll;
  body.scrollTop=newY;updateProg(frac,ps.durSec);
  curElapsedSec=ps.startSec+elapsed;
  if(songTimelineSec>0) highlightNowPlaying(curElapsedSec);
  if(newY>=ps.totalScroll-1){pausePlay();updateProg(1,ps.durSec);return;}
  rafId=requestAnimationFrame(rafLoop);
}

// ── "Now playing" line highlight — avança no ritmo real do BPM/compasso/
//    compassos (tempo real decorrido), não pela fração de pixels rolados.
//    Isso funciona igual seja o play iniciado do topo ou de um bloco marcado. ──
let timedEls=null,nowPlayingIdx=-1;
function buildTimedEls(){
  timedEls=[...document.querySelectorAll('#song-body [data-t0]')].map(el=>
    ({el,t0:+el.dataset.t0,t1:+el.dataset.t1,hl:el.dataset.hl==='1'}));
  nowPlayingIdx=-1;
}
function highlightNowPlaying(elapsedSec){
  if(!timedEls||!timedEls.length)return;
  const hlEls=timedEls.filter(t=>t.hl);
  if(!hlEls.length)return;
  let match=hlEls.find(t=>elapsedSec>=t.t0&&elapsedSec<t.t1);
  if(!match&&elapsedSec>=hlEls[hlEls.length-1].t1) match=hlEls[hlEls.length-1];
  if(!match&&elapsedSec<hlEls[0].t0) match=hlEls[0];
  const idx=match?timedEls.indexOf(match):-1;
  if(idx===nowPlayingIdx)return;
  // Limpa QUALQUER linha destacada no DOM (não só a rastreada em nowPlayingIdx)
  // pra garantir que nunca fique mais de uma linha em destaque ao mesmo tempo.
  document.querySelectorAll('#song-body .now-playing').forEach(e=>e.classList.remove('now-playing'));
  if(idx>=0) timedEls[idx].el.classList.add('now-playing');
  nowPlayingIdx=idx;
}
function clearNowPlaying(){
  document.querySelectorAll('#song-body .now-playing').forEach(e=>e.classList.remove('now-playing'));
  timedEls=null;nowPlayingIdx=-1;
}
// ── Tick de metrônomo, no ritmo do BPM (mesmo intervalo do play-btn piscando) ──
let tickTimerId=null,tickNextTime=0,tickBeatCount=0;
function toggleTick(){
  tickEnabled=!tickEnabled;
  document.getElementById('tick-btn').classList.toggle('active',tickEnabled);
  if(tickEnabled&&playing) startTickScheduler();
  else stopTickScheduler();
}
function startTickScheduler(){
  const ctx=getCtx();
  tickNextTime=ctx.currentTime+0.05;
  tickBeatCount=0;
  scheduleTick();
}
function stopTickScheduler(){
  if(tickTimerId){clearTimeout(tickTimerId);tickTimerId=null;}
}
function scheduleTick(){
  if(!playing||!tickEnabled)return;
  const ctx=getCtx();
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  const secPerBeat=60/bpm;
  const beatsPerBar=(cur&&cur.beat)||4;
  const LOOK=0.12;
  while(tickNextTime<ctx.currentTime+LOOK){
    synthTick(ctx,tickNextTime,tickBeatCount%beatsPerBar===0);
    tickNextTime+=secPerBeat;tickBeatCount++;
  }
  tickTimerId=setTimeout(scheduleTick,25);
}

// ── Som real da batida (não só o tick) — toca o pattern de bateria salvo do
//    bloco atual, no ritmo real decorrido, igual o preview da tela de Ritmo. ──
let beatTimerId=null,beatNextTime=0,beatStep=0,beatSecIdx=-1;
function toggleBeatSound(){
  beatSoundEnabled=!beatSoundEnabled;
  document.getElementById('beat-btn').classList.toggle('active',beatSoundEnabled);
  if(beatSoundEnabled&&playing) startBeatScheduler();
  else stopBeatScheduler();
}
function startBeatScheduler(){
  beatSecIdx=-1;beatStep=0;
  scheduleBeatSound();
}
function stopBeatScheduler(){
  if(beatTimerId){clearTimeout(beatTimerId);beatTimerId=null;}
}
function scheduleBeatSound(){
  if(!playing||!beatSoundEnabled)return;
  if(songBeatSections&&songBeatSections.length){
    const ctx=getCtx();
    const secIdx=songBeatSections.findIndex(s=>curElapsedSec>=s.t0&&curElapsedSec<s.t1);
    if(secIdx!==-1){
      const sec=songBeatSections[secIdx];
      if(secIdx!==beatSecIdx){beatSecIdx=secIdx;beatStep=0;beatNextTime=ctx.currentTime+0.05;}
      const LOOK=0.15;
      while(beatNextTime<ctx.currentTime+LOOK){
        const step=beatStep%sec.totalSteps;
        sec.pattern.forEach((row,ri)=>{
          const inst=DRUM_INSTS[ri];if(!inst)return;
          const state=cellState(row[step]);
          if(state) inst.play(ctx,beatNextTime,state===2?GHOST_VEL:1);
        });
        beatNextTime+=sec.secPerStep;beatStep++;
      }
    }
  }
  beatTimerId=setTimeout(scheduleBeatSound,25);
}

function seekClick(e){
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const body=document.getElementById('song-body');if(!body)return;
  body.scrollTop=pct*(body.scrollHeight-body.clientHeight);
  const dur=parseDur(document.getElementById('dur-in').value);
  updateProg(pct,dur);
  curElapsedSec=songTimelineSec>0?pct*songTimelineSec:0;
  if(playing){pausePlay();startPlay();}
}
