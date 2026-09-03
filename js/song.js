// ════════════════════════════════════════════════════════
//  SONG RENDER — um bloco colorido por anotação, igual à
//  planilha original (sem fundir seções sem letra na anterior).
// ════════════════════════════════════════════════════════
function renderSong(){
  if(!cur) return;
  applyFs();
  document.getElementById('hd-title').textContent=cur.name;
  syncFavBtn();
  manualDurVal=cur.duration||'3:30';
  document.getElementById('dur-in').value=manualDurVal;
  playStartSec=0;curElapsedSec=0; // nova música: play recomeça do topo até o usuário marcar um bloco

  // Legend
  const seen=new Map();
  cur.items.forEach(row=>{
    if(row.type!=='ann') return;
    getAllCols(row.text).forEach(c=>{if(c.label&&!seen.has(c.label)) seen.set(c.label,c);});
  });
  document.getElementById('legend').innerHTML=[...seen.values()].map(c=>
    `<span class="leg-pill" style="background:${c.bg}18;border-color:${c.bg}55">
      <span style="color:${c.bg};font-weight:700">${c.label}</span>
    </span>`).join('');

  // Scroll speed: two modes — manual (Tempo) or auto from BPM (BPM)
  scrollMode=cur.bpm?'bpm':'time';
  document.getElementById('scroll-bpm-in').value=cur.bpm||100;
  document.getElementById('scroll-bars-in').value=computeTotalBars();
  document.getElementById('scroll-beat-in').value=cur.beat||4;
  syncScrollModeUI();

  // Build sheet HTML
  const dom=cur.dom||'#7fa37a';
  const bpmTxt=cur.bpm?` · ${cur.bpm} BPM`:'';
  let html=`
    <div class="sheet-title">
      <div class="sheet-title-name" style="color:${dom};text-shadow:0 0 40px ${dom}44">${esc(cur.name)}</div>
      <div class="sheet-title-meta">${cur.sections} seções${bpmTxt}</div>
      <div class="sheet-title-div" style="background:linear-gradient(90deg,transparent,${dom},transparent)"></div>
    </div>`;

  // Parse annotation: split [TYPE (rhythm)] or [TYPE] (rhythm)
  function parseAnn(text){
    const mBracket=text.match(/^(\[[^\]]+\])\s*(.*)/);
    const type=mBracket?mBracket[1]:text;
    const rest=(mBracket?mBracket[2]:'').trim();
    return {type,rest};
  }

  // Group items into sections: one ann header + its following lyric lines.
  // Cada seção vira seu próprio bloco na tela — igual à planilha original,
  // onde cada [Tag] tem seu retângulo colorido, mesmo repetido em sequência.
  const sections=[];
  let sec=null;
  cur.items.forEach(item=>{
    if(item.type==='ann'){ sec={ann:item,lyrics:[]}; sections.push(sec); }
    else if(item.type==='lyric'){ if(!sec){sec={ann:null,lyrics:[]};sections.push(sec);} sec.lyrics.push(item); }
  });

  blockMeta=[];
  let annIdx=0;
  sections.forEach(s=>{
    let headHtml='',color='#7fa37a',tx='#111';
    const noLyrics=s.lyrics.length===0;
    let eb=null;
    if(s.ann){
      const cols=getAllCols(s.ann.text);
      // Cor vinda de um import exato (ex: xlsx com a cor real da célula) manda
      // sempre — a tag só decide a cor quando a anotação não trouxe uma própria.
      if(s.ann.exact){ color=s.ann.bg; tx=s.ann.tx||contrastText(color); }
      else { color=cols[0]?cols[0].bg:s.ann.bg; tx=cols[0]?cols[0].tx:(s.ann.tx||contrastText(color)); }
      const {type,rest}=parseAnn(s.ann.text);
      eb=cur.edBlocks&&cur.edBlocks[annIdx];
      annIdx++;
      headHtml=`<div class="sheet-block-hd">
        <span class="sec-type">${boldify(type)}</span>
        ${rest?`<span class="sec-rhythm">${boldify(rest)}</span>`:''}
      </div>`;
    }
    const lyricsHtml=s.lyrics.map(l=>`<div class="sheet-block-lyric">${boldify(l.text)}</div>`).join('');
    const bodyHtml=noLyrics?'':`<div class="sheet-block-body">${lyricsHtml}</div>`;
    blockMeta.push({bars:s.ann?.bars??1,lineCount:(s.ann?1:0)+s.lyrics.length||1,eb,el:null,t0:0,t1:0,centerY:0});
    html+=`<div class="sheet-block" style="background:${color};color:${tx}" onclick="setPlayStart(this)" title="Toque para começar o play a partir daqui">${headHtml}${bodyHtml}</div>`;
  });

  const body=document.getElementById('song-body');
  body.innerHTML=html;
  [...body.querySelectorAll('.sheet-block')].forEach((el,i)=>{blockMeta[i].el=el;});
  syncBodyPadding();
  computeTimeline();
  buildBlockMap();
  currentBlockIdx=-1;
  resetProg();
  scrollToBlock(findBlockIdx(curElapsedSec),true);
}

// Padding vertical = metade da altura disponível de #song-body — é o que
// deixa o primeiro e o último bloco chegarem ao centro da tela. Precisa
// ser medido em JS: um padding em vh não sabe quanto espaço o cabeçalho e
// a barra de play já tomaram, e um em % seria relativo à LARGURA da caixa
// (regra do CSS para padding percentual), não à altura.
function syncBodyPadding(){
  const body=document.getElementById('song-body');if(!body)return;
  body.style.paddingTop='0px';body.style.paddingBottom='0px';
  const half=(body.clientHeight/2)+'px';
  body.style.paddingTop=half;body.style.paddingBottom=half;
}

function applyFs(){
  document.documentElement.style.setProperty('--fs',fs+'px');
  const lbl=document.getElementById('fs-label');
  if(lbl)lbl.textContent=fs;
  if(cur&&document.getElementById('screen-song')&&!document.getElementById('screen-song').classList.contains('hidden')){
    syncBodyPadding();
    buildBlockMap();
    if(!playing) scrollToBlock(currentBlockIdx,true);
  }
}
function adjFs(d){fs=Math.max(10,Math.min(34,fs+d));applyFs();saveAll();}

// ════════════════════════════════════════════════════════
//  SCROLL SPEED MODE — "Tempo" (duração manual) ou "BPM" (auto).
//  Os dois alimentam a MESMA linha do tempo (computeTimeline): o
//  que muda é só como o peso de cada bloco é medido — em compassos
//  (BPM) ou em linhas de texto (Tempo, sem precisar de compasso).
// ════════════════════════════════════════════════════════
let manualDurVal='3:30'; // duração digitada no modo Tempo — independente da duração calculada no modo BPM
function setScrollMode(mode){
  if(scrollMode==='time'){
    manualDurVal=document.getElementById('dur-in').value||manualDurVal;
  }
  scrollMode=mode;
  syncScrollModeUI();
  computeTimeline();
}
function onDurInInput(v){manualDurVal=v;computeTimeline();}
function onDurInChange(v){
  if(!cur||scrollMode!=='time')return;
  cur.duration=v;saveAll();fbSaveSong(cur);
}
function syncScrollModeUI(){
  document.getElementById('mode-time-btn').classList.toggle('active',scrollMode==='time');
  document.getElementById('mode-bpm-btn').classList.toggle('active',scrollMode==='bpm');
  const durIn=document.getElementById('dur-in');
  const durLbl=document.getElementById('dur-lbl');
  const bpmWrap=document.getElementById('scroll-bpm-wrap');
  if(scrollMode==='bpm'){
    bpmWrap.classList.remove('hidden');
    durIn.readOnly=true;durIn.classList.add('auto');
    if(durLbl)durLbl.textContent='Duração (auto)';
    updateAutoDuration();
  } else {
    bpmWrap.classList.add('hidden');
    durIn.readOnly=false;durIn.classList.remove('auto');
    if(durLbl)durLbl.textContent='Duração';
    durIn.value=manualDurVal;
  }
}
function computeTotalBars(){
  if(!cur) return 16;
  return cur.items.filter(x=>x.type==='ann').reduce((a,x)=>a+(x.bars??1),0)||16;
}
function updateAutoDuration(){
  if(!cur) return;
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  const bars=parseInt(document.getElementById('scroll-bars-in').value)||computeTotalBars();
  const beat=parseInt(document.getElementById('scroll-beat-in').value)||4;
  const sec=Math.round((bars*beat*60)/bpm);
  document.getElementById('dur-in').value=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
  computeTimeline();
}

// ════════════════════════════════════════════════════════
//  TIMELINE — reparte a duração total (dur-in) entre os blocos,
//  proporcional ao peso de cada um: compassos no modo BPM, linhas
//  de texto no modo Tempo. Roda toda vez que duração/modo/bpm muda,
//  e de novo ao dar play — é o que faz o scroll saber onde centralizar.
// ════════════════════════════════════════════════════════
function computeTimeline(){
  if(!cur||!blockMeta.length) return;
  const totalDur=parseDur(document.getElementById('dur-in').value);
  const beatPerBar=cur.beat||4;
  const weights=blockMeta.map(m=>Math.max(0.001,scrollMode==='bpm'?(m.bars||1):m.lineCount));
  const sumW=weights.reduce((a,b)=>a+b,0);
  songBeatSections=[];
  let acc=0;
  blockMeta.forEach((m,i)=>{
    const dur=totalDur*weights[i]/sumW;
    m.t0=acc;m.t1=acc+dur;acc+=dur;
    if(m.eb&&m.eb.pattern){
      const totalSteps=(m.bars||1)*beatPerBar*(m.eb.subdivision||1);
      if(totalSteps>0) songBeatSections.push({t0:m.t0,t1:m.t1,pattern:m.eb.pattern,totalSteps,secPerStep:dur/totalSteps});
    }
  });
  songTimelineSec=acc;
}
