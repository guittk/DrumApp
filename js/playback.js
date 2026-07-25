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
  if(body.scrollTop>=total-4)body.scrollTop=0;
  const curY=body.scrollTop,frac=curY/total,timeLeft=Math.max(0.5,dur*(1-frac));
  ps={startTime:performance.now(),startScroll:curY,totalScroll:total,durSec:dur,speed:(total-curY)/timeLeft};
  playing=true;
  const btn=document.getElementById('play-btn');
  btn.textContent='⏸';
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  btn.style.animationDuration=(60/bpm)+'s';
  btn.classList.add('beating');
  buildTimedEls();
  if(rafId)cancelAnimationFrame(rafId);rafId=requestAnimationFrame(rafLoop);
}
function pausePlay(){
  playing=false;if(rafId){cancelAnimationFrame(rafId);rafId=null;}
  const btn=document.getElementById('play-btn');
  btn.textContent='▶';btn.classList.remove('beating');
}
function stopPlay(){pausePlay();const body=document.getElementById('song-body');if(body)body.scrollTop=0;ps=null;resetProg();clearNowPlaying();}
function rafLoop(now){
  if(!playing||!ps)return;
  const body=document.getElementById('song-body');if(!body){playing=false;return;}
  const elapsed=(now-ps.startTime)/1000,newY=ps.startScroll+ps.speed*elapsed;
  const frac=newY/ps.totalScroll;
  body.scrollTop=newY;updateProg(frac,ps.durSec);
  if(songTimelineSec>0) highlightNowPlaying(frac*songTimelineSec);
  if(newY>=ps.totalScroll-1){pausePlay();updateProg(1,ps.durSec);return;}
  rafId=requestAnimationFrame(rafLoop);
}

// ── "Now playing" line highlight — synced to BPM/compasso/compassos, not to
//    whatever the scroll duration is set to (see songTimelineSec in song.js) ──
let timedEls=null,nowPlayingIdx=-1;
function buildTimedEls(){
  timedEls=[...document.querySelectorAll('#song-body [data-t0]')].map(el=>({el,t0:+el.dataset.t0,t1:+el.dataset.t1}));
  nowPlayingIdx=-1;
}
function highlightNowPlaying(elapsedSec){
  if(!timedEls||!timedEls.length)return;
  let idx=timedEls.findIndex(t=>elapsedSec>=t.t0&&elapsedSec<t.t1);
  if(idx===-1&&timedEls.length&&elapsedSec>=timedEls[timedEls.length-1].t1) idx=timedEls.length-1;
  if(idx===nowPlayingIdx)return;
  if(nowPlayingIdx>=0&&timedEls[nowPlayingIdx]) timedEls[nowPlayingIdx].el.classList.remove('now-playing');
  if(idx>=0) timedEls[idx].el.classList.add('now-playing');
  nowPlayingIdx=idx;
}
function clearNowPlaying(){
  if(nowPlayingIdx>=0&&timedEls&&timedEls[nowPlayingIdx]) timedEls[nowPlayingIdx].el.classList.remove('now-playing');
  timedEls=null;nowPlayingIdx=-1;
}
function seekClick(e){
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const body=document.getElementById('song-body');if(!body)return;
  body.scrollTop=pct*(body.scrollHeight-body.clientHeight);
  const dur=parseDur(document.getElementById('dur-in').value);
  updateProg(pct,dur);if(playing){pausePlay();startPlay();}
}
