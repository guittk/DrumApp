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
function blendColors(hexArr){
  const arr=(hexArr||[]).filter(Boolean);
  if(!arr.length)return '#7C5CFC';
  if(arr.length===1)return arr[0];
  let r=0,g=0,b=0;
  arr.forEach(hex=>{
    const h=hex.replace('#','');
    r+=parseInt(h.substring(0,2),16);g+=parseInt(h.substring(2,4),16);b+=parseInt(h.substring(4,6),16);
  });
  r=Math.round(r/arr.length);g=Math.round(g/arr.length);b=Math.round(b/arr.length);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

// ── TAGS SCREEN ─────────────────────────────────────────
function goTags(){show('screen-tags');renderTagsScreen();}
function renderTagsScreen(){
  const el=document.getElementById('tags-list');
  const list=getTags();
  el.innerHTML=list.map(t=>`
    <div class="tag-row" data-k="${t.k}">
      <input class="tag-color-in" type="color" value="${t.bg}" oninput="updateTag('${t.k}',{bg:this.value})">
      <input class="tag-label-in" type="text" value="${esc(t.label)}" placeholder="Nome da tag" oninput="updateTag('${t.k}',{label:this.value})">
      <input class="tag-keyword-in" type="text" value="${esc(t.keyword)}" placeholder="palavra-chave" oninput="updateTag('${t.k}',{keyword:this.value})">
      <button class="tag-del-btn" onclick="removeTagRow('${t.k}')">✕</button>
    </div>`).join('');
}
function removeTagRow(k){removeTag(k);renderTagsScreen();}
function addTagRow(){
  const label='Nova Tag';
  const k=slugifyTagKey(label);
  addTag({k,label,bg:'#D0D0D0',tx:'#111',keyword:escRegex(label)});
  renderTagsScreen();
}
function resetTagsRow(){if(confirm('Restaurar as tags para o padrão? Isso apaga suas personalizações.')){resetTagsDefault();renderTagsScreen();}}
