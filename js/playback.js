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
  playing=true;document.getElementById('play-btn').textContent='⏸';
  if(rafId)cancelAnimationFrame(rafId);rafId=requestAnimationFrame(rafLoop);
}
function pausePlay(){playing=false;if(rafId){cancelAnimationFrame(rafId);rafId=null;}document.getElementById('play-btn').textContent='▶';}
function stopPlay(){pausePlay();const body=document.getElementById('song-body');if(body)body.scrollTop=0;ps=null;resetProg();}
function rafLoop(now){
  if(!playing||!ps)return;
  const body=document.getElementById('song-body');if(!body){playing=false;return;}
  const elapsed=(now-ps.startTime)/1000,newY=ps.startScroll+ps.speed*elapsed;
  body.scrollTop=newY;updateProg(newY/ps.totalScroll,ps.durSec);
  if(newY>=ps.totalScroll-1){pausePlay();updateProg(1,ps.durSec);return;}
  rafId=requestAnimationFrame(rafLoop);
}
function seekClick(e){
  const rect=e.currentTarget.getBoundingClientRect();
  const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const body=document.getElementById('song-body');if(!body)return;
  body.scrollTop=pct*(body.scrollHeight-body.clientHeight);
  const dur=parseDur(document.getElementById('dur-in').value);
  updateProg(pct,dur);if(playing){pausePlay();startPlay();}
}
