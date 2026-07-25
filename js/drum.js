// ════════════════════════════════════════════════════════
//  DRUM SEQUENCER
// ════════════════════════════════════════════════════════
const GHOST_VEL=0.35; // volume relativo de uma ghost note
const DRUM_INSTS=[
  {key:'hihat_c',label:'HH Fech',bg:'#22C55E',
   play:(ctx,t,vel=1)=>synthHihat(ctx,t,false,vel)},
  {key:'hihat_o',label:'HH Aber',bg:'#86EFAC',
   play:(ctx,t,vel=1)=>synthHihat(ctx,t,true,vel)},
  {key:'bumbo',  label:'Bumbo',  bg:'#F97316',
   play:(ctx,t,vel=1)=>synthKick(ctx,t,vel)},
  {key:'caixa',  label:'Caixa',  bg:'#3B82F6',
   play:(ctx,t,vel=1)=>synthSnare(ctx,t,vel)},
  {key:'tom',    label:'Tom',    bg:'#FBBF24',
   play:(ctx,t,vel=1)=>synthTom(ctx,t,vel)},
  {key:'surdo',  label:'Surdo',  bg:'#A855F7',
   play:(ctx,t,vel=1)=>synthSurdo(ctx,t,vel)},
  {key:'ride',   label:'Ride',   bg:'#EF4444',
   play:(ctx,t,vel=1)=>synthRide(ctx,t,vel)}
];
// Estado de uma célula do sequenciador: 0=vazia, 1=nota normal, 2=ghost note (mais fraca)
function cellState(v){return v===2?2:(v?1:0);}
function compassoLabel(n){return n===6?'6/8':n+'/4';}
// Batidas por compasso — vem do "Compasso" da música (2/4,3/4,4/4,6/8); cada batida
// ainda é subdividida em 4 (semicolcheias), então 6/8 dá 6 células em vez de 4.
let drumBeatsPerBar=4;
function stepsPerBar(){return drumBeatsPerBar*4;}
let drumBars=1, drumTotalSteps=16;
let drumPattern=DRUM_INSTS.map(()=>Array(32).fill(false));
let drumBlockIdx=-1;
let drumPlaying=false, drumStep=0, drumNextTime=0, drumTimerId=null;

// ── Sequencer UI ───────────────────────────────────────
function openDrum(blockIdx){
  drumBlockIdx=blockIdx;
  const b=edBlocks[blockIdx];
  const beatEl=document.getElementById('ed-beat');
  drumBeatsPerBar=parseInt(beatEl&&beatEl.value)||4;
  // Restore saved pattern if exists
  if(b.pattern){
    drumPattern=b.pattern.map(row=>[...row]);
    drumBars=b.bars||1;
  } else {
    drumPattern=DRUM_INSTS.map(()=>Array(stepsPerBar()*4).fill(false));
    drumBars=1;
  }
  drumTotalSteps=drumBars*stepsPerBar();
  const bpm=parseInt(document.getElementById('ed-bpm').value)||100;
  document.getElementById('drum-bpm').value=bpm;
  document.getElementById('drum-hd-title').textContent=`Bloco ${blockIdx+1} — Ritmo`;
  document.getElementById('drum-beat-info').textContent=compassoLabel(drumBeatsPerBar);
  show('screen-drum');
  renderDrumGrid();
  updateDrumBarBtns();
}
function closeDrum(){stopDrumPlay();show('screen-editor');}

function setDrumBars(n){
  drumBars=n;drumTotalSteps=n*stepsPerBar();
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
    for(let beat=0;beat<drumBars*drumBeatsPerBar;beat++){
      const cells=[];
      for(let sub=0;sub<4;sub++){
        const step=beat*4+sub;
        if(step>=drumTotalSteps) continue;
        const state=cellState(drumPattern[row][step]);
        const canGhost=inst.key==='caixa';
        cells.push(`<div class="drum-cell${state===1?' on':''}${state===2?' ghost':''}" id="dc-${row}-${step}"
          style="${state?'background:'+inst.bg+(state===2?'55':'')+';':''}"
          data-row="${row}" data-step="${step}"
          title="${canGhost?'Toque: normal → ghost note → vazio':'Toque para ligar/desligar'}"
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

// Ciclo por toque: vazia → nota normal → (ghost note, só na caixa) → vazia
function toggleStep(row,step){
  const canGhost=DRUM_INSTS[row].key==='caixa';
  const state=cellState(drumPattern[row][step]);
  const next=canGhost?(state===0?1:(state===1?2:0)):(state?0:1);
  drumPattern[row][step]=next;
  const cell=document.getElementById(`dc-${row}-${step}`);
  if(!cell) return;
  cell.classList.toggle('on',next===1);
  cell.classList.toggle('ghost',next===2);
  cell.style.background=next?DRUM_INSTS[row].bg+(next===2?'55':''):'';
}

function clearDrum(){drumPattern=DRUM_INSTS.map(()=>Array(stepsPerBar()*4).fill(0));renderDrumGrid();}

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
      const state=cellState(drumPattern[row][step]);
      if(state) inst.play(ctx,drumNextTime,state===2?GHOST_VEL:1);
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
// hit: objeto {bumbo,caixa,tom,hihat_c,hihat_o,ride,surdo} -> boolean
function stepSyllables(hit){
  const bumbo=hit.bumbo,caixa=hit.caixa,tom=hit.tom,hhC=hit.hihat_c,hhO=hit.hihat_o,ride=hit.ride,surdo=hit.surdo;
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
      const hit={};
      let anyOn=false,allGhost=true;
      DRUM_INSTS.forEach((inst,row)=>{
        const state=cellState(drumPattern[row][step]);
        hit[inst.key]=state>0;
        if(state){anyOn=true;if(state!==2)allGhost=false;}
      });
      let syl=stepSyllables(hit);
      if(syl&&anyOn&&allGhost) syl='('+syl.toLowerCase()+')'; // ghost note: entre parênteses e minúsculo
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
