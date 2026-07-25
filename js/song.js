// ════════════════════════════════════════════════════════
//  SONG RENDER (redesigned)
// ════════════════════════════════════════════════════════
function renderSong(){
  if(!cur) return;
  applyFs();
  document.getElementById('hd-title').textContent=cur.name;
  syncFavBtn();
  manualDurVal=cur.duration||'3:30';
  document.getElementById('dur-in').value=manualDurVal;

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
  const dom=cur.dom||'#7C5CFC';
  const bpmTxt=cur.bpm?` · ${cur.bpm} BPM`:'';
  let html=`
    <div class="sheet-title">
      <div class="sheet-title-name" style="color:${dom};text-shadow:0 0 40px ${dom}44">${esc(cur.name)}</div>
      <div class="sheet-title-meta">${cur.sections} seções${bpmTxt}</div>
      <div class="sheet-title-div" style="background:linear-gradient(90deg,transparent,${dom},transparent)"></div>
    </div>`;

  // Parse annotation: split [TYPE (rhythm)] or [TYPE] (rhythm)
  function parseAnn(text){
    // [TYPE] (rhythm) or [TYPE text (rhythm)]
    const mBracket=text.match(/^(\[[^\]]+\])\s*(.*)/);
    const type=mBracket?mBracket[1]:text;
    const rest=(mBracket?mBracket[2]:'').trim();
    return {type,rest};
  }

  // Group items into sections: one ann header + its following lyric lines
  const sections=[];
  let sec=null;
  cur.items.forEach(item=>{
    if(item.type==='ann'){ sec={ann:item,lyrics:[]}; sections.push(sec); }
    else if(item.type==='lyric'){ if(!sec){sec={ann:null,lyrics:[]};sections.push(sec);} sec.lyrics.push(item); }
  });

  // Sections with no lyrics inside join the block above, UNLESS their tag is the
  // same as the section right above them — same-tag headers stay as their own card
  // instead of stacking silently into the previous one.
  // A header with no lyrics under it has nothing to box off, so it skips the
  // (empty) body div and drops its border — it reads as a plain trailing label.
  const blocks=[];
  let lastTagKey=null;
  // Timeline: how long each section lasts (bars × compasso ÷ BPM) drives which
  // line gets the "now playing" highlight during playback. No BPM, no timeline.
  let tSec=0;
  const beatPerBar=cur.beat||4;
  sections.forEach(s=>{
    let headHtml='',color='#7C5CFC',tagKey=null;
    const noLyrics=s.lyrics.length===0;
    const secDur=cur.bpm?((s.ann?.bars||1)*beatPerBar*60/cur.bpm):null;
    if(s.ann){
      const cols=getAllCols(s.ann.text);
      color=cols[0]?cols[0].bg:s.ann.bg;
      tagKey=cols[0]?cols[0].k:null;
      const {type,rest}=parseAnn(s.ann.text);
      const borderStyle=noLyrics?'':`;border-color:${color}66`;
      const headTimeAttr=(noLyrics&&secDur!==null)?` data-t0="${tSec.toFixed(3)}" data-t1="${(tSec+secDur).toFixed(3)}"`:'';
      headHtml=`<div class="sheet-section-hd"${headTimeAttr} style="background:${color}22${borderStyle}">
        <span class="sec-type" style="color:${color}">${boldify(type)}</span>
        ${rest?`<span class="sec-rhythm">${boldify(rest)}</span>`:''}
      </div>`;
    }
    const lineDur=(secDur!==null&&s.lyrics.length)?secDur/s.lyrics.length:null;
    const lyricsHtml=s.lyrics.map((l,li)=>{
      const timeAttr=lineDur!==null?` data-t0="${(tSec+li*lineDur).toFixed(3)}" data-t1="${(tSec+(li+1)*lineDur).toFixed(3)}"`:'';
      return `<div class="sheet-lyric-line"${timeAttr}>${boldify(l.text)}</div>`;
    }).join('');
    const bodyHtml=noLyrics?'':`<div class="sheet-section-body">${lyricsHtml}</div>`;
    if(secDur!==null) tSec+=secDur;

    const sameTagAsAbove=tagKey!==null&&tagKey===lastTagKey;
    if(noLyrics && blocks.length && !sameTagAsAbove){
      blocks[blocks.length-1].html+=headHtml+bodyHtml;
    }else{
      blocks.push({color,html:headHtml+bodyHtml});
    }
    lastTagKey=tagKey;
  });
  songTimelineSec=tSec;
  blocks.forEach(b=>{
    html+=`<div class="sheet-section" style="--sec-color:${b.color}">${b.html}</div>`;
  });

  const body=document.getElementById('song-body');
  body.innerHTML=html;
  body.scrollTop=0;
  resetProg();
  clearNowPlaying();
}

function applyFs(){
  document.documentElement.style.setProperty('--fs',fs+'px');
  const lbl=document.getElementById('fs-label');
  if(lbl)lbl.textContent=fs;
}
function adjFs(d){fs=Math.max(10,Math.min(34,fs+d));applyFs();saveAll();}

// ════════════════════════════════════════════════════════
//  SCROLL SPEED MODE — "Tempo" (duração manual) ou "BPM" (auto)
// ════════════════════════════════════════════════════════
let manualDurVal='3:30'; // duração digitada no modo Tempo — independente da duração calculada no modo BPM
function setScrollMode(mode){
  if(scrollMode==='time'){
    manualDurVal=document.getElementById('dur-in').value||manualDurVal;
  }
  scrollMode=mode;
  syncScrollModeUI();
}
function onDurInInput(v){manualDurVal=v;}
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
  return cur.items.filter(x=>x.type==='ann').reduce((a,x)=>a+(x.bars||1),0)||16;
}
function updateAutoDuration(){
  if(!cur) return;
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  const bars=parseInt(document.getElementById('scroll-bars-in').value)||computeTotalBars();
  const beat=parseInt(document.getElementById('scroll-beat-in').value)||4;
  const sec=Math.round((bars*beat*60)/bpm);
  document.getElementById('dur-in').value=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}
