// ════════════════════════════════════════════════════════
//  TAGS (instrumentos/anotações) — configurável pelo usuário
// ════════════════════════════════════════════════════════
const DEFAULT_TAG={k:'default',label:'',bg:'#D0D0D0',tx:'#111',keyword:''};
const DEFAULT_TAGS=[
  {k:'hihat',     label:'HiHat',      bg:'#33CC33',tx:'#052e16',keyword:'hi[-\\s]?hat|chimbal'},
  {k:'pausa',     label:'Pausa',      bg:'#FFFF99',tx:'#1a1a00',keyword:'\\bpausa\\b'},
  {k:'tribal',    label:'Tribal',     bg:'#9966BB',tx:'#fff',   keyword:'tribal'},
  {k:'surdo',     label:'Surdo',      bg:'#CC99DD',tx:'#1a0020',keyword:'\\bsurdo\\b'},
  {k:'ride',      label:'Ride',       bg:'#FF7777',tx:'#1a0000',keyword:'\\bride\\b'},
  {k:'caixa',     label:'Caixa',      bg:'#33CCEE',tx:'#00151a',keyword:'\\bcaixa\\b'},
  {k:'bumbo',     label:'Bumbo',      bg:'#FFAAAA',tx:'#1a0000',keyword:'\\bbumbo\\b'},
  {k:'marcacao',  label:'Marcação',   bg:'#FFAAAA',tx:'#1a0000',keyword:'marca[çc][aã]o|marcacao'},
  {k:'acentuacao',label:'Acentuação', bg:'#FFAAAA',tx:'#111',   keyword:'acent'},
  {k:'crescente', label:'Crescente',  bg:'#FF7777',tx:'#1a0000',keyword:'crescente'},
  {k:'aro',       label:'Aro',        bg:'#AACC55',tx:'#0a1800',keyword:'\\baro\\b'},
  {k:'virada',    label:'Virada',     bg:'#FFD580',tx:'#1a1000',keyword:'virada'},
  {k:'pratos',    label:'Pratos',     bg:'#FF7777',tx:'#111',   keyword:'\\bprato'}
];
const DEFAULT_PALETTE=[...new Set(DEFAULT_TAGS.map(t=>t.bg))];

function getTags(){
  try{
    const raw=localStorage.getItem('thurgh_tags');
    if(raw){const list=JSON.parse(raw);if(Array.isArray(list)&&list.length)return list;}
  }catch(e){}
  setTags(JSON.parse(JSON.stringify(DEFAULT_TAGS)));
  return getTags();
}
function setTags(list){try{localStorage.setItem('thurgh_tags',JSON.stringify(list));}catch(e){}}
function resetTagsDefault(){setTags(JSON.parse(JSON.stringify(DEFAULT_TAGS)));}
function addTag(tag){const list=getTags();list.push(tag);setTags(list);}
function updateTag(k,fields){const list=getTags();const i=list.findIndex(t=>t.k===k);if(i>=0){Object.assign(list[i],fields);setTags(list);}}
function removeTag(k){setTags(getTags().filter(t=>t.k!==k));}
function slugifyTagKey(label){
  const base=(label||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'')||'tag';
  let k=base,n=1;const existing=new Set(getTags().map(t=>t.k));
  while(existing.has(k)){k=base+(++n);}
  return k;
}
function escRegex(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

function tagRegex(t){try{return new RegExp(t.keyword,'i');}catch(e){return new RegExp(escRegex(t.keyword||t.label||''),'i');}}
function getCol(ann){
  const list=getTags();
  for(const t of list){if(t.keyword&&tagRegex(t).test(ann||''))return t;}
  return DEFAULT_TAG;
}
function getAllCols(ann){
  const list=getTags();
  const matches=list.filter(t=>t.keyword&&tagRegex(t).test(ann||''));
  return matches.length?matches:[DEFAULT_TAG];
}
function contrastText(hex){
  const h=(hex||'').replace('#','');
  if(h.length!==6)return '#111';
  const r=parseInt(h.substring(0,2),16),g=parseInt(h.substring(2,4),16),b=parseInt(h.substring(4,6),16);
  const luma=(0.299*r+0.587*g+0.114*b)/255;
  return luma>0.6?'#111':'#fff';
}

// ── COLOR PALETTE (predefined colors used by tags) ──────
function getPalette(){
  try{
    const raw=localStorage.getItem('thurgh_palette');
    if(raw){const list=JSON.parse(raw);if(Array.isArray(list)&&list.length)return list;}
  }catch(e){}
  setPalette([...DEFAULT_PALETTE]);
  return getPalette();
}
function setPalette(list){try{localStorage.setItem('thurgh_palette',JSON.stringify(list));}catch(e){}}
function resetPaletteDefault(){setPalette([...DEFAULT_PALETTE]);renderPaletteScreen();}
function addPaletteColor(){const list=getPalette();list.push('#D0D0D0');setPalette(list);renderPaletteScreen();}
function updatePaletteColor(idx,hex){const list=getPalette();list[idx]=hex;setPalette(list);renderPaletteScreen();}
function removePaletteColor(idx){const list=getPalette();list.splice(idx,1);setPalette(list);renderPaletteScreen();}

// ── TAGS SCREEN ─────────────────────────────────────────
let tagsTab='tags';
function goTags(){show('screen-tags');renderTagsScreen();renderPaletteScreen();setTagsTab(tagsTab);}
function setTagsTab(tab){
  tagsTab=tab;
  document.getElementById('tab-tags-btn').classList.toggle('active',tab==='tags');
  document.getElementById('tab-palette-btn').classList.toggle('active',tab==='palette');
  document.getElementById('tags-list').classList.toggle('hidden',tab!=='tags');
  document.getElementById('palette-list').classList.toggle('hidden',tab!=='palette');
  document.getElementById('tags-add-btn').textContent=tab==='tags'?'＋ Nova':'＋ Nova cor';
  document.getElementById('tags-reset-btn').textContent=tab==='tags'?'↺ Restaurar tags padrão':'↺ Restaurar cores padrão';
}
function addTagsScreenItem(){tagsTab==='tags'?addTagRow():addPaletteColor();}
async function resetTagsScreenItem(){
  if(tagsTab==='tags'){resetTagsRow();return;}
  if(await showConfirm('Restaurar as cores predefinidas para o padrão?'))resetPaletteDefault();
}

let colorPickerOpenFor=null;
function toggleColorPicker(k,ev){
  if(ev)ev.stopPropagation();
  colorPickerOpenFor=colorPickerOpenFor===k?null:k;
  renderTagsScreen();
}
document.addEventListener('click',(ev)=>{
  if(colorPickerOpenFor&&!ev.target.closest('.tag-color-wrap')){
    colorPickerOpenFor=null;
    renderTagsScreen();
  }
});
function tagColorSwatches(t){
  return getPalette().map(hex=>`
    <button type="button" class="tag-swatch${t.bg.toLowerCase()===hex.toLowerCase()?' sel':''}"
      style="background:${hex}" title="${hex}"
      onclick="updateTag('${t.k}',{bg:'${hex}',tx:'${contrastText(hex)}'});colorPickerOpenFor=null;renderTagsScreen()"></button>`).join('');
}
function renderTagsScreen(){
  const el=document.getElementById('tags-list');
  const list=getTags();
  el.innerHTML=list.map(t=>`
    <div class="tag-row" data-k="${t.k}">
      <div class="tag-color-wrap">
        <button type="button" class="tag-dot" style="background:${t.bg}" title="Escolher cor" onclick="toggleColorPicker('${t.k}',event)"></button>
        ${colorPickerOpenFor===t.k?`<div class="tag-color-popover">${tagColorSwatches(t)}</div>`:''}
      </div>
      <input class="tag-label-in" type="text" value="${esc(t.label)}" placeholder="Nome da tag" oninput="updateTag('${t.k}',{label:this.value})">
      <input class="tag-keyword-in" type="text" value="${esc(t.keyword)}" placeholder="palavra-chave" oninput="updateTag('${t.k}',{keyword:this.value})">
      <button class="tag-del-btn" onclick="removeTagRow('${t.k}')">✕</button>
    </div>`).join('');
}
function removeTagRow(k){removeTag(k);renderTagsScreen();}
function addTagRow(){
  const label='Nova Tag';
  const k=slugifyTagKey(label);
  const bg=getPalette()[0]||'#D0D0D0';
  addTag({k,label,bg,tx:contrastText(bg),keyword:escRegex(label)});
  renderTagsScreen();
}
async function resetTagsRow(){if(await showConfirm('Restaurar as tags para o padrão? Isso apaga suas personalizações.')){resetTagsDefault();renderTagsScreen();}}

function renderPaletteScreen(){
  const el=document.getElementById('palette-list');
  const list=getPalette();
  el.innerHTML=list.map((hex,idx)=>`
    <div class="tag-row" data-idx="${idx}">
      <input class="tag-color-in" type="color" value="${hex}" oninput="updatePaletteColor(${idx},this.value)">
      <span class="palette-hex">${hex}</span>
      <button class="tag-del-btn" onclick="removePaletteColor(${idx})">✕</button>
    </div>`).join('');
}
