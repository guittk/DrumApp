// ════════════════════════════════════════════════════════
//  PLAYBACK — o bloco atual fica centralizado na tela (o de cima
//  e os próximos ficam visíveis, sem precisar rolar manualmente).
//  Só desliza quando troca de bloco; enquanto o bloco não termina,
//  a tela fica parada — mais fácil de ler do que scroll contínuo.
// ════════════════════════════════════════════════════════
function parseDur(s){s=(s||'3:30').trim();const p=s.split(':');if(p.length===2)return Math.max(1,parseInt(p[0]||0)*60+parseInt(p[1]||0));return Math.max(1,parseFloat(s)*60||210);}
function fmt(sec){sec=Math.max(0,Math.round(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
function resetProg(){document.getElementById('prog-fill').style.width='0%';document.getElementById('pb-el').textContent='0:00';document.getElementById('pb-rem').textContent='';}
function updateProg(pct,dur){pct=Math.max(0,Math.min(1,pct));document.getElementById('prog-fill').style.width=(pct*100).toFixed(1)+'%';document.getElementById('pb-el').textContent=fmt(pct*dur);document.getElementById('pb-rem').textContent='-'+fmt((1-pct)*dur);}
function togglePlay(){playing?pausePlay():startPlay();}

// ── Mapa bloco → posição na tela (recalculado sempre que o layout
//    muda: nova música, fonte, redimensionamento). Usa getBoundingClientRect
//    em vez de offsetTop: #song-body é position:static, então offsetTop dos
//    blocos seria relativo ao <body> da página (incluindo o cabeçalho fixo
//    acima do scroll), não ao próprio #song-body — descentralizaria tudo
//    por exatamente a altura do cabeçalho+legenda. ──────────────────────
function buildBlockMap(){
  const body=document.getElementById('song-body');if(!body)return;
  const bodyTop=body.getBoundingClientRect().top-body.scrollTop;
  blockMeta.forEach(m=>{
    if(!m.el)return;
    const r=m.el.getBoundingClientRect();
    m.centerY=(r.top-bodyTop)+r.height/2;
  });
}
function findBlockIdx(t){
  if(!blockMeta.length) return -1;
  for(let i=0;i<blockMeta.length;i++){ if(t<blockMeta[i].t1||i===blockMeta.length-1) return i; }
  return blockMeta.length-1;
}
function scrollToBlock(idx,instant){
  if(idx<0||!blockMeta[idx])return;
  const body=document.getElementById('song-body');if(!body)return;
  const maxTop=Math.max(0,body.scrollHeight-body.clientHeight);
  const target=Math.max(0,Math.min(blockMeta[idx].centerY-body.clientHeight/2,maxTop));
  if(instant) body.scrollTop=target;
  else body.scrollTo({top:target,behavior:'smooth'});
  setCurrentBlock(idx);
}
function setCurrentBlock(idx){
  if(idx===currentBlockIdx)return;
  document.querySelectorAll('#song-body .sheet-block.current').forEach(e=>e.classList.remove('current'));
  if(idx>=0&&blockMeta[idx]&&blockMeta[idx].el) blockMeta[idx].el.classList.add('current');
  currentBlockIdx=idx;
}

function startPlay(){
  const body=document.getElementById('song-body');if(!body||!blockMeta.length)return;
  computeTimeline();buildBlockMap();
  const dur=parseDur(document.getElementById('dur-in').value);
  if(curElapsedSec>=dur-0.05) curElapsedSec=playStartSec; // já tinha chegado no fim — recomeça do bloco marcado
  ps={startTime:performance.now(),startSec:curElapsedSec,durSec:dur};
  playing=true;
  const btn=document.getElementById('play-btn');
  btn.textContent='⏸';
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  btn.style.animationDuration=(60/bpm)+'s';
  btn.classList.add('beating');
  scrollToBlock(findBlockIdx(curElapsedSec),false);
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
  curElapsedSec=playStartSec;resetProg();
  if(blockMeta.length){computeTimeline();buildBlockMap();scrollToBlock(findBlockIdx(curElapsedSec),true);}
}

// ── Marcar de onde o play deve começar (ex: ensaiar um bloco específico) ──
// playStartSec vem do próprio data-t0 do bloco (a linha do tempo atual,
// BPM ou Tempo — as duas alimentam o mesmo computeTimeline).
function setPlayStart(el){
  const already=el.classList.contains('play-start-marker');
  document.querySelectorAll('.sheet-block.play-start-marker').forEach(e=>e.classList.remove('play-start-marker'));
  const idx=blockMeta.findIndex(m=>m.el===el);
  if(already){
    playStartSec=0;curElapsedSec=0;
    if(!playing) scrollToBlock(0,true);
    return;
  }
  el.classList.add('play-start-marker');
  playStartSec=idx>=0?blockMeta[idx].t0:0;
  curElapsedSec=playStartSec;
  if(!playing) scrollToBlock(idx,true);
}
function rafLoop(now){
  if(!playing||!ps)return;
  curElapsedSec=ps.startSec+(now-ps.startTime)/1000;
  const idx=findBlockIdx(curElapsedSec);
  if(idx!==currentBlockIdx) scrollToBlock(idx,false);
  updateProg(curElapsedSec/ps.durSec,ps.durSec);
  if(curElapsedSec>=ps.durSec){pausePlay();updateProg(1,ps.durSec);return;}
  rafId=requestAnimationFrame(rafLoop);
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
  if(!blockMeta.length)return;
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const dur=parseDur(document.getElementById('dur-in').value);
  curElapsedSec=pct*dur;
  updateProg(pct,dur);
  scrollToBlock(findBlockIdx(curElapsedSec),true);
  if(playing){pausePlay();startPlay();}
}
