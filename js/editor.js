// ════════════════════════════════════════════════════════
//  EDITOR
// ════════════════════════════════════════════════════════
let edBlocks=[]; // [{inst:'hihat', rhythm:'', lyrics:'', pattern:null, bars:1}]
let edEditingSong=null; // song being edited (null = new)

const INST_OPTS=[
  {k:'hihat',    label:'HiHat',     bg:'#33CC33',tx:'#052e16'},
  {k:'ride',     label:'Ride',      bg:'#FF7777',tx:'#1a0000'},
  {k:'surdo',    label:'Surdo',     bg:'#CC99DD',tx:'#1a0020'},
  {k:'tribal',   label:'Tribal',    bg:'#9966BB',tx:'#fff'},
  {k:'caixa',    label:'Caixa',     bg:'#33CCEE',tx:'#00151a'},
  {k:'bumbo',    label:'Bumbo',     bg:'#FFAAAA',tx:'#1a0000'},
  {k:'pausa',    label:'Pausa',     bg:'#FFFF99',tx:'#1a1a00'},
  {k:'aro',      label:'Aro',       bg:'#AACC55',tx:'#0a1800'},
  {k:'marcacao', label:'Marcação',  bg:'#FFAAAA',tx:'#1a0000'},
  {k:'crescente',label:'Crescente', bg:'#FF7777',tx:'#1a0000'},
  {k:'virada',   label:'Virada',    bg:'#FFD580',tx:'#1a1000'},
  {k:'default',  label:'Outro',     bg:'#D0D0D0',tx:'#111'}
];

function openEditor(song){
  edEditingSong=song||null;
  if(song&&song.created&&song.edBlocks){
    edBlocks=JSON.parse(JSON.stringify(song.edBlocks));
    document.getElementById('ed-name').value=song.name;
    document.getElementById('ed-bpm').value=song.bpm||100;
    document.getElementById('ed-hd-title').textContent='Editar Música';
  } else {
    edBlocks=[{inst:'hihat',rhythm:'',lyrics:'',pattern:null,bars:1}];
    document.getElementById('ed-name').value='';
    document.getElementById('ed-bpm').value='100';
    document.getElementById('ed-hd-title').textContent='Nova Música';
  }
  show('screen-editor');
  renderEditorBlocks();
}
function cancelEditor(){goList();}

function renderEditorBlocks(){
  const el=document.getElementById('ed-blocks');
  el.innerHTML=edBlocks.map((b,i)=>{
    const instButtons=INST_OPTS.map(opt=>`
      <button class="ed-inst-btn${b.inst===opt.k?' sel':''}"
        style="background:${opt.bg};color:${opt.tx}"
        onclick="setBlockInst(${i},'${opt.k}')">${opt.label}</button>`).join('');
    const c=INST_OPTS.find(o=>o.k===b.inst)||INST_OPTS[0];
    return `<div class="ed-block" id="edblock-${i}">
      <div class="ed-block-hd" style="border-left:3px solid ${c.bg}">
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

function setBlockInst(idx,k){edBlocks[idx].inst=k;renderEditorBlocks();}
function addEditorBlock(){edBlocks.push({inst:'hihat',rhythm:'',lyrics:'',pattern:null,bars:1});renderEditorBlocks();setTimeout(()=>{document.getElementById('ed-blocks').scrollTop=9999;},50);}
function removeBlock(idx){if(edBlocks.length<=1)return;edBlocks.splice(idx,1);renderEditorBlocks();}
function moveBlock(idx,dir){const ni=idx+dir;if(ni<0||ni>=edBlocks.length)return;[edBlocks[idx],edBlocks[ni]]=[edBlocks[ni],edBlocks[idx]];renderEditorBlocks();}

function saveEditorSong(){
  const name=document.getElementById('ed-name').value.trim();
  if(!name){alert('Por favor, dê um nome para a música.');return;}
  const bpm=parseInt(document.getElementById('ed-bpm').value)||null;

  // Build items array (same format as CSV songs)
  const items=[];
  edBlocks.forEach((b,bi)=>{
    if(bi>0) items.push({type:'empty'});
    const c=INST_OPTS.find(o=>o.k===b.inst)||INST_OPTS[0];
    const col=getCol(`[${c.label}]`);
    const annText=`[${c.label}]${b.rhythm?' ('+b.rhythm+')':''}`;
    items.push({type:'ann',text:annText,bg:col.bg,tx:col.tx,bars:b.bars});
    const lyrLines=(b.lyrics||'').split('\n').map(l=>l.trim()).filter(Boolean);
    lyrLines.forEach(l=>items.push({type:'lyric',text:l,accent:col.bg}));
  });

  const cnt={};
  items.filter(x=>x.type==='ann').forEach(x=>{cnt[x.bg]=(cnt[x.bg]||0)+1;});
  const dom=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0]||'#7C5CFC';
  const sections=items.filter(x=>x.type==='ann').length;

  const song={name,bpm,items,dom,sections,created:true,edBlocks:JSON.parse(JSON.stringify(edBlocks))};

  if(edEditingSong){
    const idx=songs.indexOf(edEditingSong);
    if(idx>=0) songs[idx]=song;
    else songs.push(song);
  } else {
    songs.push(song);
  }
  saveAll();goList();
}
