// ════════════════════════════════════════════════════════
//  SONG RENDER (redesigned)
// ════════════════════════════════════════════════════════
function renderSong(){
  if(!cur) return;
  applyFs();
  document.getElementById('hd-title').textContent=cur.name;
  syncFavBtn();

  // Legend
  const seen=new Map();
  cur.items.forEach(row=>{
    if(row.type!=='ann') return;
    const c=getCol(row.text);
    if(c.label&&!seen.has(c.label)) seen.set(c.label,c);
  });
  document.getElementById('legend').innerHTML=[...seen.values()].map(c=>
    `<span class="leg-pill" style="background:${c.bg}18;border-color:${c.bg}55">
      <span class="leg-icon">${getIcon(c.label)}</span>
      <span style="color:${c.bg};font-weight:700">${c.label}</span>
    </span>`).join('');

  // Scroll speed: two modes — manual (Tempo) or auto from BPM (BPM)
  scrollMode=cur.bpm?'bpm':'time';
  document.getElementById('scroll-bpm-in').value=cur.bpm||100;
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

  sections.forEach(s=>{
    let headHtml='',color='#7C5CFC';
    if(s.ann){
      color=s.ann.bg;
      const col=getCol(s.ann.text);
      const icon=getIcon(col.label);
      const {type,rest}=parseAnn(s.ann.text);
      headHtml=`<div class="sheet-section-hd" style="background:${color}22;border-color:${color}66">
        <span class="sec-icon">${icon}</span>
        <span class="sec-type" style="color:${color}">${boldify(type)}</span>
        ${rest?`<span class="sec-rhythm">${boldify(rest)}</span>`:''}
      </div>`;
    }
    const lyricsHtml=s.lyrics.map(l=>`<div class="sheet-lyric-line">${boldify(l.text)}</div>`).join('');
    html+=`<div class="sheet-section" style="--sec-color:${color}">${headHtml}<div class="sheet-section-body">${lyricsHtml}</div></div>`;
  });

  const body=document.getElementById('song-body');
  body.innerHTML=html;
  body.scrollTop=0;
  resetProg();
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
function setScrollMode(mode){scrollMode=mode;syncScrollModeUI();}
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
  }
}
function updateAutoDuration(){
  if(!cur) return;
  const bpm=parseInt(document.getElementById('scroll-bpm-in').value)||100;
  const totalBars=cur.items.filter(x=>x.type==='ann').reduce((a,x)=>a+(x.bars||1),0)||16;
  const sec=Math.round((totalBars*4*60)/bpm);
  document.getElementById('dur-in').value=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}
