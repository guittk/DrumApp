// ════════════════════════════════════════════════════════
//  DRUM SEQUENCER
// ════════════════════════════════════════════════════════
const DRUM_INSTS=[
  {key:'bumbo',  label:'Bumbo',  bg:'#F97316',
   play:(ctx,t)=>synthKick(ctx,t)},
  {key:'caixa',  label:'Caixa',  bg:'#3B82F6',
   play:(ctx,t)=>synthSnare(ctx,t)},
  {key:'tom',    label:'Tom',    bg:'#FBBF24',
   play:(ctx,t)=>synthTom(ctx,t)},
  {key:'hihat_c',label:'HH Fech',bg:'#22C55E',
   play:(ctx,t)=>synthHihat(ctx,t,false)},
  {key:'hihat_o',label:'HH Aber',bg:'#86EFAC',
   play:(ctx,t)=>synthHihat(ctx,t,true)},
  {key:'ride',   label:'Ride',   bg:'#EF4444',
   play:(ctx,t)=>synthRide(ctx,t)},
  {key:'surdo',  label:'Surdo',  bg:'#A855F7',
   play:(ctx,t)=>synthSurdo(ctx,t)}
];
const STEPS_PER_BAR=16;
let drumBars=1, drumTotalSteps=16;
let drumPattern=DRUM_INSTS.map(()=>Array(32).fill(false));
let drumBlockIdx=-1;
let drumPlaying=false, drumStep=0, drumNextTime=0, drumTimerId=null;

// ── Sequencer UI ───────────────────────────────────────
function openDrum(blockIdx){
  drumBlockIdx=blockIdx;
  const b=edBlocks[blockIdx];
  // Restore saved pattern if exists
  if(b.pattern){
    drumPattern=b.pattern.map(row=>[...row]);
    drumBars=b.bars||1;
  } else {
    drumPattern=DRUM_INSTS.map(()=>Array(STEPS_PER_BAR*4).fill(false));
    drumBars=1;
  }
  drumTotalSteps=drumBars*STEPS_PER_BAR;
  const bpm=parseInt(document.getElementById('ed-bpm').value)||100;
  document.getElementById('drum-bpm').value=bpm;
  document.getElementById('drum-hd-title').textContent=`Bloco ${blockIdx+1} — Ritmo`;
  show('screen-drum');
  renderDrumGrid();
  updateDrumBarBtns();
}
function closeDrum(){stopDrumPlay();show('screen-editor');}

function setDrumBars(n){
  drumBars=n;drumTotalSteps=n*STEPS_PER_BAR;
  updateDrumBarBtns();renderDrumGrid();
}
function updateDrumBarBtns(){
  [1,2,4].forEach(n=>{
    document.getElementById('dbar-'+n).classList.toggle('active',drumBars===n);
  });
  document.getElementById('drum-step-info').textContent=`${drumTotalSteps} passos`;
}

function renderDrumGrid(){
  const grid=document.getElementById('drum-grid');
  grid.innerHTML=DRUM_INSTS.map((inst,row)=>{
    const groups=[];
    for(let beat=0;beat<drumBars*4;beat++){
      const cells=[];
      for(let sub=0;sub<4;sub++){
        const step=beat*4+sub;
        if(step>=drumTotalSteps) continue;
        const on=drumPattern[row][step];
        cells.push(`<div class="drum-cell${on?' on':''}" id="dc-${row}-${step}"
          style="${on?'background:'+inst.bg+';':''}"
          data-row="${row}" data-step="${step}"
          ontouchstart="dcTouch(event)" onclick="dcClick(event)"></div>`);
      }
      groups.push(`<div class="drum-beat-group">${cells.join('')}</div>`);
    }
    return `<div class="drum-row">
      <div class="drum-label" style="color:${inst.bg}">${inst.label}</div>
      ${groups.join('<div class="drum-beat-sep"></div>')}
    </div>`;
  }).join('');
}

function dcClick(e){toggleStep(+e.currentTarget.dataset.row,+e.currentTarget.dataset.step);}
function dcTouch(e){e.preventDefault();toggleStep(+e.currentTarget.dataset.row,+e.currentTarget.dataset.step);}

function toggleStep(row,step){
  drumPattern[row][step]=!drumPattern[row][step];
  const cell=document.getElementById(`dc-${row}-${step}`);
  if(!cell) return;
  const on=drumPattern[row][step];
  cell.classList.toggle('on',on);
  cell.style.background=on?DRUM_INSTS[row].bg:'';
}

function clearDrum(){drumPattern=DRUM_INSTS.map(()=>Array(STEPS_PER_BAR*4).fill(false));renderDrumGrid();}

// ── Playback Scheduler ─────────────────────────────────
function toggleDrumPlay(){drumPlaying?stopDrumPlay():startDrumPlay();}
function startDrumPlay(){
  const ctx=getCtx();
  drumStep=0;drumNextTime=ctx.currentTime+0.05;drumPlaying=true;
  document.getElementById('drum-play-btn').textContent='⏹ Stop';
  document.getElementById('drum-play-btn').classList.add('playing');
  scheduleDrum();
}
function stopDrumPlay(){
  drumPlaying=false;
  if(drumTimerId){clearTimeout(drumTimerId);drumTimerId=null;}
  // clear highlights
  document.querySelectorAll('.drum-cell.playing-highlight').forEach(c=>c.classList.remove('playing-highlight'));
  const btn=document.getElementById('drum-play-btn');
  if(btn){btn.textContent='▶ Preview';btn.classList.remove('playing');}
}
function scheduleDrum(){
  if(!drumPlaying) return;
  const ctx=getCtx();
  const secPerStep=(60/parseInt(document.getElementById('drum-bpm').value||100))/4;
  const LOOK=0.12;
  while(drumNextTime<ctx.currentTime+LOOK){
    const step=drumStep%drumTotalSteps;
    DRUM_INSTS.forEach((inst,row)=>{
      if(drumPattern[row][step]) inst.play(ctx,drumNextTime);
    });
    const t=drumNextTime,s=step;
    const delay=(t-ctx.currentTime)*1000;
    setTimeout(()=>highlightStep(s),Math.max(0,delay));
    drumNextTime+=secPerStep;drumStep++;
  }
  drumTimerId=setTimeout(scheduleDrum,25);
}
function highlightStep(step){
  document.querySelectorAll('.drum-cell.playing-highlight').forEach(c=>c.classList.remove('playing-highlight'));
  DRUM_INSTS.forEach((_,row)=>{
    const c=document.getElementById(`dc-${row}-${step}`);
    if(c) c.classList.add('playing-highlight');
  });
}

// ── Generate notation from pattern (Tu/Ta/Tra/Bu/Pam) ──
// Linhas de DRUM_INSTS: 0 bumbo,1 caixa,2 tom,3 hihat_c,4 hihat_o,5 ride,6 surdo
function stepSyllables(hit){
  const bumbo=hit[0],caixa=hit[1],tom=hit[2],hhC=hit[3],hhO=hit[4],ride=hit[5],surdo=hit[6];
  if(caixa&&bumbo){
    let s='Tra';
    if(tom)s+='Tu';
    if(hhC||hhO)s+='Ta';
    if(ride)s+='Pam';
    if(surdo)s+='Bu';
    return s;
  }
  if(bumbo&&surdo){
    let s='TuBu';
    if(caixa)s+='Ta';
    if(tom)s+='Tu';
    if(hhC||hhO)s+='Ta';
    if(ride)s+='Pam';
    return s;
  }
  let s='';
  if(bumbo)s+='Tu';
  if(surdo)s+='Tu';
  if(tom)s+='Tu';
  if(caixa)s+='Ta';
  if(hhC||hhO)s+='Ta';
  if(ride)s+='Pam';
  return s;
}
function patternToNotation(){
  const steps=drumTotalSteps;
  const beats=steps/4;
  const parts=[];
  for(let beat=0;beat<beats;beat++){
    let beatStr='';
    for(let sub=0;sub<4;sub++){
      const step=beat*4+sub;
      const hit=DRUM_INSTS.map((_,row)=>drumPattern[row][step]);
      const syl=stepSyllables(hit);
      beatStr+=(syl||'.')+'.';
    }
    parts.push(beatStr.replace(/\.+$/,''));
  }
  return parts.join(' ').trim();
}

function saveDrumPattern(){
  stopDrumPlay();
  const notation=patternToNotation();
  const b=edBlocks[drumBlockIdx];
  b.pattern=drumPattern.map(row=>[...row]);
  b.bars=drumBars;
  if(notation) b.rhythm=notation;
  // Update rhythm input in editor
  const rin=document.getElementById('ed-rhythm-'+drumBlockIdx);
  if(rin) rin.value=notation;
  closeDrum();
}
