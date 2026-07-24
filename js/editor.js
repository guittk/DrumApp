// ════════════════════════════════════════════════════════
//  EDITOR
// ════════════════════════════════════════════════════════
let edBlocks=[]; // [{insts:['hihat'], rhythm:'', lyrics:'', pattern:null, bars:1}]
let edEditingSong=null; // song being edited (null = new)

function blockInsts(b){return Array.isArray(b.insts)?b.insts:[b.inst||'hihat'];}

function openEditor(song){
  edEditingSong=song||null;
  if(song&&song.edBlocks){
    edBlocks=JSON.parse(JSON.stringify(song.edBlocks));
    document.getElementById('ed-name').value=song.name;
    document.getElementById('ed-bpm').value=song.bpm||100;
    const durIn=document.getElementById('ed-duration');if(durIn)durIn.value=song.duration||'';
    document.getElementById('ed-hd-title').textContent='Editar Música';
  } else {
    edBlocks=[{insts:['hihat'],rhythm:'',lyrics:'',pattern:null,bars:1}];
    document.getElementById('ed-name').value='';
    document.getElementById('ed-bpm').value='100';
    const durIn=document.getElementById('ed-duration');if(durIn)durIn.value='';
    document.getElementById('ed-hd-title').textContent='Nova Música';
  }
  show('screen-editor');
  renderEditorBlocks();
}
function cancelEditor(){goList();}

// Converte uma música (vinda do CSV, sem edBlocks) em blocos editáveis
function songToEdBlocks(song){
  const blocks=[];
  let cur=null;
  (song.items||[]).forEach(item=>{
    if(item.type==='ann'){
      const m=item.text.match(/^(\[[^\]]+\])\s*(.*)/);
      const bracket=m?m[1]:item.text;
      const rest=m?m[2].trim():'';
      const rhythm=rest.replace(/^\(|\)$/g,'');
      const cols=getAllCols(bracket);
      const insts=cols.filter(c=>c.k!=='default').map(c=>c.k);
      cur={insts:insts.length?insts:['default'],rhythm,lyrics:'',pattern:null,bars:item.bars||1,_lyrLines:[]};
      blocks.push(cur);
    } else if(item.type==='lyric'){
      if(!cur){cur={insts:['default'],rhythm:'',lyrics:'',pattern:null,bars:1,_lyrLines:[]};blocks.push(cur);}
      cur._lyrLines.push(item.text);
    }
  });
  blocks.forEach(b=>{b.lyrics=b._lyrLines.join('\n');delete b._lyrLines;});
  return blocks.length?blocks:[{insts:['hihat'],rhythm:'',lyrics:'',pattern:null,bars:1}];
}

function editCurrentSong(){
  if(!cur)return;
  const song=cur.edBlocks?cur:Object.assign({},cur,{edBlocks:songToEdBlocks(cur)});
  openEditor(song);
}

function renderEditorBlocks(){
  const el=document.getElementById('ed-blocks');
  const tags=getTags();
  el.innerHTML=edBlocks.map((b,i)=>{
    const insts=blockInsts(b);
    const instButtons=tags.map(opt=>`
      <button class="ed-inst-btn${insts.includes(opt.k)?' sel':''}"
        style="background:${opt.bg};color:${opt.tx}"
        onclick="toggleBlockInst(${i},'${opt.k}')">${esc(opt.label)}</button>`).join('');
    const selCols=insts.map(k=>tags.find(o=>o.k===k)).filter(Boolean);
    const borderColor=blendColors(selCols.map(c=>c.bg));
    return `<div class="ed-block" id="edblock-${i}">
      <div class="ed-block-hd" style="border-left:3px solid ${borderColor}">
        <span class="ed-block-num">${i+1}</span>
        <div class="ed-inst-select">${instButtons}</div>
        <div class="ed-bars-wrap">
          <input class="ed-bars-in" id="ed-bars-${i}" type="number" min="1" max="32"
            value="${b.bars||1}" oninput="edBlocks[${i}].bars=Math.max(1,parseInt(this.value)||1)">
          <span class="ed-bars-lbl">Compassos</span>
        </div>
        <div class="ed-block-actions">
          <button class="ed-act-btn ed-drum-btn${b.pattern?' has-pattern':''}"
            onclick="openDrum(${i})">🎹 Ritmo</button>
          <button class="ed-act-btn" onclick="moveBlock(${i},-1)" ${i===0?'disabled':''}>↑</button>
          <button class="ed-act-btn" onclick="moveBlock(${i},1)" ${i===edBlocks.length-1?'disabled':''}>↓</button>
          <button class="ed-act-btn" onclick="removeBlock(${i})">✕</button>
        </div>
      </div>
      <input class="ed-rhythm-in" id="ed-rhythm-${i}"
        placeholder="(ritmo manual, ex: Tu.. Ta.. Tu.. Ta...)"
        value="${esc(b.rhythm||'')}"
        oninput="edBlocks[${i}].rhythm=this.value">
      <textarea class="ed-lyrics-ta" id="ed-lyrics-${i}"
        placeholder="Letras (uma linha por vez)…"
        rows="4"
        oninput="edBlocks[${i}].lyrics=this.value">${esc(b.lyrics||'')}</textarea>
    </div>`;
  }).join('');
}

function toggleBlockInst(idx,k){
  const b=edBlocks[idx];
  const insts=blockInsts(b);
  const pos=insts.indexOf(k);
  if(pos>=0){if(insts.length>1)insts.splice(pos,1);}
  else insts.push(k);
  b.insts=insts;delete b.inst;
  renderEditorBlocks();
}
function addEditorBlock(){edBlocks.push({insts:['hihat'],rhythm:'',lyrics:'',pattern:null,bars:1});renderEditorBlocks();setTimeout(()=>{document.getElementById('ed-blocks').scrollTop=9999;},50);}
function removeBlock(idx){if(edBlocks.length<=1)return;edBlocks.splice(idx,1);renderEditorBlocks();}
function moveBlock(idx,dir){const ni=idx+dir;if(ni<0||ni>=edBlocks.length)return;[edBlocks[idx],edBlocks[ni]]=[edBlocks[ni],edBlocks[idx]];renderEditorBlocks();}

function saveEditorSong(){
  const name=document.getElementById('ed-name').value.trim();
  if(!name){alert('Por favor, dê um nome para a música.');return;}
  const bpm=parseInt(document.getElementById('ed-bpm').value)||null;
  const durEl=document.getElementById('ed-duration');
  const duration=durEl&&durEl.value.trim()?durEl.value.trim():null;
  const tags=getTags();
  const oldName=edEditingSong?edEditingSong.name:null;

  // Build items array (same format as CSV songs)
  const items=[];
  edBlocks.forEach((b,bi)=>{
    if(bi>0) items.push({type:'empty'});
    const insts=blockInsts(b);
    const cols=insts.map(k=>tags.find(o=>o.k===k)).filter(Boolean);
    const label=cols.map(c=>c.label).filter(Boolean).join(' + ')||'Outro';
    const bg=blendColors(cols.map(c=>c.bg))||'#D0D0D0';
    const tx=cols[0]?cols[0].tx:'#111';
    const annText=`[${label}]${b.rhythm?' ('+b.rhythm+')':''}`;
    items.push({type:'ann',text:annText,bg,tx,bars:b.bars});
    const lyrLines=(b.lyrics||'').split('\n').map(l=>l.trim()).filter(Boolean);
    lyrLines.forEach(l=>items.push({type:'lyric',text:l,accent:bg}));
  });

  const cnt={};
  items.filter(x=>x.type==='ann').forEach(x=>{cnt[x.bg]=(cnt[x.bg]||0)+1;});
  const dom=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0]||'#7C5CFC';
  const sections=items.filter(x=>x.type==='ann').length;

  const song={name,bpm,duration,items,dom,sections,created:true,
    col:edEditingSong&&edEditingSong.col!==undefined?edEditingSong.col:undefined,
    edBlocks:JSON.parse(JSON.stringify(edBlocks))};

  if(edEditingSong){
    const idx=songs.indexOf(edEditingSong);
    if(idx>=0) songs[idx]=song;
    else songs.push(song);
  } else {
    songs.push(song);
  }
  if(oldName&&oldName!==name&&favs.has(oldName)){favs.delete(oldName);favs.add(name);}
  saveAll();
  if(typeof writeCsvBack==='function')writeCsvBack();
  goList();
}
