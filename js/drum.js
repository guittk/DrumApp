// ════════════════════════════════════════════════════════
//  DRUM SEQUENCER
// ════════════════════════════════════════════════════════
const GHOST_VEL=0.35; // volume relativo de uma ghost note
// countsForText:false — HH, Ride e Crash tocam no preview mas não entram na
// conversão do ritmo pra texto (só bumbo/caixa/tom/surdo formam as sílabas).
const DRUM_INSTS=[
  {key:'hihat_c',label:'HH Fech',bg:'#22C55E',countsForText:false,
   play:(ctx,t,vel=1)=>synthHihat(ctx,t,false,vel)},
  {key:'hihat_o',label:'HH Aber',bg:'#86EFAC',countsForText:false,
   play:(ctx,t,vel=1)=>synthHihat(ctx,t,true,vel)},
  {key:'ride',   label:'Ride',   bg:'#EF4444',countsForText:false,
   play:(ctx,t,vel=1)=>synthRide(ctx,t,vel)},
  {key:'crash',  label:'Crash',  bg:'#DC2626',countsForText:false,
   play:(ctx,t,vel=1)=>synthCrash(ctx,t,vel)},
  {key:'bumbo',  label:'Bumbo',  bg:'#F97316',countsForText:true,
   play:(ctx,t,vel=1)=>synthKick(ctx,t,vel)},
  {key:'caixa',  label:'Caixa',  bg:'#3B82F6',countsForText:true,
   play:(ctx,t,vel=1)=>synthSnare(ctx,t,vel)},
  {key:'tom',    label:'Tom',    bg:'#FBBF24',countsForText:true,
   play:(ctx,t,vel=1)=>synthTom(ctx,t,vel)},
  {key:'surdo',  label:'Surdo',  bg:'#A855F7',countsForText:true,
   play:(ctx,t,vel=1)=>synthSurdo(ctx,t,vel)}
];
// Estado de uma célula do sequenciador: 0=vazia, 1=nota normal, 2=ghost note (mais fraca)
function cellState(v){return v===2?2:(v?1:0);}
function compassoLabel(n){return n===6?'6/8':n+'/4';}
// Batidas por compasso — vem do "Compasso" da música (2/4,3/4,4/4,6/8).
let drumBeatsPerBar=4;
// Divisão de cada batida: 1=semínima, 2=colcheia, 3=tercina, 4=semicolcheia.
let drumSubdivision=1;
function stepsPerBar(){return drumBeatsPerBar*drumSubdivision;}
// Sílabas de contagem por batida, na ordem em que aparecem dentro dela.
function subdivisionSyllables(sub){
  if(sub===2) return ['','+'];
  if(sub===3) return ['','tri','plê'];
  if(sub===4) return ['','e','+','a'];
  return [''];
}
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
  drumSubdivision=b.subdivision||1;
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
  document.getElementById('drum-subdiv-select').value=drumSubdivision;
  show('screen-drum');
  renderDrumGrid();
  updateDrumBarBtns();
}
function setDrumSubdivision(v){
  drumSubdivision=parseInt(v)||1;
  drumTotalSteps=drumBars*stepsPerBar();
  renderDrumGrid();
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

// Constrói, por compasso, um grupo (drum-beat-group) por batida — cada grupo tem
// `drumSubdivision` células (1 p/ semínima, 2 colcheia, 3 tercina, 4 semicolcheia).
function renderDrumGrid(){
  const grid=document.getElementById('drum-grid');
  grid.innerHTML=DRUM_INSTS.map((inst,row)=>{
    const bars=[];
    for(let bar=0;bar<drumBars;bar++){
      const beatGroups=[];
      for(let beat=0;beat<drumBeatsPerBar;beat++){
        const cells=[];
        for(let s=0;s<drumSubdivision;s++){
          const step=(bar*drumBeatsPerBar+beat)*drumSubdivision+s;
          if(step>=drumTotalSteps) continue;
          const state=cellState(drumPattern[row][step]);
          const canGhost=inst.key==='caixa';
          cells.push(`<div class="drum-cell${state===1?' on':''}${state===2?' ghost':''}" id="dc-${row}-${step}"
            style="${state?'background:'+inst.bg+(state===2?'55':'')+';':''}"
            data-row="${row}" data-step="${step}"
            title="${canGhost?'Toque: normal → ghost note → vazio':'Toque para ligar/desligar'}"
            ontouchstart="dcTouch(event)" onclick="dcClick(event)"></div>`);
        }
        beatGroups.push(`<div class="drum-beat-group">${cells.join('')}</div>`);
      }
      bars.push(beatGroups.join(''));
    }
    return `<div class="drum-row">
      <div class="drum-label" style="color:${inst.bg}">${inst.label}</div>
      ${bars.join('<div class="drum-beat-sep"></div>')}
    </div>`;
  }).join('');
  renderCountRow();
  updateDrumPreview();
}

// Régua de contagem (1 e + a, 1 tri plê, etc.) alinhada com as células, pra
// ajudar a saber em qual subdivisão da batida cada célula está.
function renderCountRow(){
  const row=document.getElementById('drum-count-row');
  if(!row) return;
  const syl=subdivisionSyllables(drumSubdivision);
  const bars=[];
  for(let bar=0;bar<drumBars;bar++){
    const beatGroups=[];
    for(let beat=0;beat<drumBeatsPerBar;beat++){
      const cells=syl.map((s,i)=>`<div class="drum-count-cell">${i===0?(beat+1):s}</div>`).join('');
      beatGroups.push(`<div class="drum-beat-group">${cells}</div>`);
    }
    bars.push(beatGroups.join(''));
  }
  row.innerHTML=`<div class="drum-label"></div>${bars.join('<div class="drum-beat-sep"></div>')}`;
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
  updateDrumPreview();
}

function clearDrum(){drumPattern=DRUM_INSTS.map(()=>Array(stepsPerBar()*4).fill(0));renderDrumGrid();}

// Mostra ao vivo como o padrão atual vira texto (mesmo formato salvo no ritmo do bloco).
function updateDrumPreview(){
  const el=document.getElementById('drum-preview-text');
  if(!el) return;
  const notation=patternToNotation();
  el.textContent=notation||'—';
}

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
  const secPerStep=(60/parseInt(document.getElementById('drum-bpm').value||100))/drumSubdivision;
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

// ── Generate notation from pattern (Tu/Ta/Tra/Bu) ──
// hit: objeto {bumbo,caixa,tom,surdo} -> boolean. HH/Ride/Crash não contam.
function stepSyllables(hit){
  const bumbo=hit.bumbo,caixa=hit.caixa,tom=hit.tom,surdo=hit.surdo;
  if(caixa&&bumbo){
    let s='Tra';
    if(tom)s+='Tu';
    if(surdo)s+='Bu';
    return s;
  }
  if(bumbo&&surdo){
    let s='TuBu';
    if(caixa)s+='Ta';
    if(tom)s+='Tu';
    return s;
  }
  let s='';
  if(bumbo)s+='Tu';
  if(surdo)s+='Tu';
  if(tom)s+='Tu';
  if(caixa)s+='Ta';
  return s;
}
function patternToNotation(){
  const parts=[];
  for(let step=0;step<drumTotalSteps;step++){
    const hit={};
    let anyOn=false,allGhost=true;
    DRUM_INSTS.forEach((inst,row)=>{
      const state=cellState(drumPattern[row][step]);
      if(!inst.countsForText)return;
      hit[inst.key]=state>0;
      if(state){anyOn=true;if(state!==2)allGhost=false;}
    });
    let syl=stepSyllables(hit);
    if(syl&&anyOn&&allGhost) syl='('+syl.toLowerCase()+')'; // ghost note: entre parênteses e minúsculo
    parts.push(syl||'.');
  }
  return parts.join(' ').trim();
}

function saveDrumPattern(){
  stopDrumPlay();
  const notation=patternToNotation();
  const b=edBlocks[drumBlockIdx];
  b.pattern=drumPattern.map(row=>[...row]);
  b.bars=drumBars;
  b.subdivision=drumSubdivision;
  if(notation) b.rhythm=notation;
  // Update rhythm input in editor
  const rin=document.getElementById('ed-rhythm-'+drumBlockIdx);
  if(rin) rin.value=notation;
  closeDrum();
}
