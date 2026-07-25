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
  ps={startTime:performance.now(),startScroll:curY,totalScroll:total,durSec:dur,speed:(total-curY)/timeLeft};
  playing=true;
  const btn=document.getElementById('play-btn');
  btn.textContent='⏸';
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  btn.style.animationDuration=(60/bpm)+'s';
  btn.classList.add('beating');
  buildTimedEls();
  if(tickEnabled) startTickScheduler();
  if(rafId)cancelAnimationFrame(rafId);rafId=requestAnimationFrame(rafLoop);
}
function pausePlay(){
  playing=false;if(rafId){cancelAnimationFrame(rafId);rafId=null;}
  const btn=document.getElementById('play-btn');
  btn.textContent='▶';btn.classList.remove('beating');
  stopTickScheduler();
}
function stopPlay(){pausePlay();const body=document.getElementById('song-body');if(body)body.scrollTop=playStartY;ps=null;resetProg();clearNowPlaying();}

// ── Marcar de onde o play deve começar (ex: ensaiar um bloco específico) ──
function setPlayStart(el){
  const body=document.getElementById('song-body');if(!body)return;
  const already=el.classList.contains('play-start-marker');
  document.querySelectorAll('.sheet-section-hd.play-start-marker').forEach(e=>e.classList.remove('play-start-marker'));
  if(already){
    playStartY=0;
  }else{
    el.classList.add('play-start-marker');
    const rect=el.getBoundingClientRect(),bodyRect=body.getBoundingClientRect();
    playStartY=Math.max(0,body.scrollTop+(rect.top-bodyRect.top));
  }
  if(!playing) body.scrollTop=playStartY;
}
function rafLoop(now){
  if(!playing||!ps)return;
  const body=document.getElementById('song-body');if(!body){playing=false;return;}
  const elapsed=(now-ps.startTime)/1000,newY=ps.startScroll+ps.speed*elapsed;
  const frac=newY/ps.totalScroll;
  body.scrollTop=newY;updateProg(frac,ps.durSec);
  if(songTimelineSec>0) highlightNowPlaying(scrollYToElapsedSec(newY));
  if(newY>=ps.totalScroll-1){pausePlay();updateProg(1,ps.durSec);return;}
  rafId=requestAnimationFrame(rafLoop);
}

// ── "Now playing" line highlight — synced to BPM/compasso/compassos, not to
//    whatever the scroll duration is set to (see songTimelineSec in song.js).
//    Each timed element's real pixel position is captured so the highlight is
//    anchored to actual scroll position, not a naive whole-page fraction —
//    otherwise starting from a marked block (not pixel 0) picks the wrong line. ──
let timedEls=null,nowPlayingIdx=-1;
function buildTimedEls(){
  const body=document.getElementById('song-body');
  const bodyRect=body.getBoundingClientRect();
  timedEls=[...document.querySelectorAll('#song-body [data-t0]')].map(el=>{
    const r=el.getBoundingClientRect();
    return {el,t0:+el.dataset.t0,t1:+el.dataset.t1,y:body.scrollTop+(r.top-bodyRect.top),hl:el.dataset.hl==='1'};
  });
  nowPlayingIdx=-1;
}
function scrollYToElapsedSec(y){
  if(!timedEls||!timedEls.length) return 0;
  if(y<=timedEls[0].y) return timedEls[0].t0;
  for(let i=0;i<timedEls.length-1;i++){
    if(y>=timedEls[i].y&&y<timedEls[i+1].y){
      const span=timedEls[i+1].y-timedEls[i].y;
      const ratio=span>0?(y-timedEls[i].y)/span:0;
      return timedEls[i].t0+ratio*(timedEls[i+1].t0-timedEls[i].t0);
    }
  }
  return timedEls[timedEls.length-1].t0;
}
function highlightNowPlaying(elapsedSec){
  if(!timedEls||!timedEls.length)return;
  const hlEls=timedEls.filter(t=>t.hl);
  if(!hlEls.length)return;
  let match=hlEls.find(t=>elapsedSec>=t.t0&&elapsedSec<t.t1);
  if(!match&&elapsedSec>=hlEls[hlEls.length-1].t1) match=hlEls[hlEls.length-1];
  const idx=match?timedEls.indexOf(match):-1;
  if(idx===nowPlayingIdx)return;
  if(nowPlayingIdx>=0&&timedEls[nowPlayingIdx]) timedEls[nowPlayingIdx].el.classList.remove('now-playing');
  if(idx>=0) timedEls[idx].el.classList.add('now-playing');
  nowPlayingIdx=idx;
}
function clearNowPlaying(){
  if(nowPlayingIdx>=0&&timedEls&&timedEls[nowPlayingIdx]) timedEls[nowPlayingIdx].el.classList.remove('now-playing');
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

function seekClick(e){
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const body=document.getElementById('song-body');if(!body)return;
  body.scrollTop=pct*(body.scrollHeight-body.clientHeight);
  const dur=parseDur(document.getElementById('dur-in').value);
  updateProg(pct,dur);if(playing){pausePlay();startPlay();}
}
