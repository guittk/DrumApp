// ════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════
const MOBILE=window.innerWidth<=768;
const CACHE_VER='v4';
let songs=[], favs=new Set(), cur=null;
let fs=MOBILE?22:16, weekMode=false;
let playing=false, rafId=null, ps=null;
let scrollMode='time'; // 'time' (duração manual) ou 'bpm' (duração automática a partir do BPM)

// ── DRUM COLORS ────────────────────────────────────────
const _TX='#111';
const COLS=[
  {k:'hihat',     re:/hi[-\s]?hat|chimbal/i,           bg:'#33CC33',tx:_TX,label:'HiHat'},
  {k:'pausa',     re:/\bpausa\b/i,                      bg:'#FFFF99',tx:_TX,label:'Pausa'},
  {k:'tribal',    re:/tribal/i,                         bg:'#CC99DD',tx:_TX,label:'Tribal'},
  {k:'surdo',     re:/\bsurdo\b/i,                      bg:'#CC99DD',tx:_TX,label:'Surdo'},
  {k:'ride',      re:/\bride\b/i,                       bg:'#FF7777',tx:_TX,label:'Ride'},
  {k:'caixa',     re:/\bcaixa\b/i,                      bg:'#33CCEE',tx:_TX,label:'Caixa'},
  {k:'bumbo',     re:/\bbumbo\b/i,                      bg:'#FFAAAA',tx:_TX,label:'Bumbo'},
  {k:'marcacao',  re:/marca[çc][aã]o|marcacao/i,        bg:'#FFAAAA',tx:_TX,label:'Marcação'},
  {k:'acentuacao',re:/acent/i,                          bg:'#FFAAAA',tx:_TX,label:'Acentuação'},
  {k:'crescente', re:/crescente/i,                      bg:'#FF7777',tx:_TX,label:'Crescente'},
  {k:'aro',       re:/\baro\b/i,                        bg:'#AACC55',tx:_TX,label:'Aro'},
  {k:'virada',    re:/virada/i,                         bg:'#FFAAAA',tx:_TX,label:'Virada'},
  {k:'pratos',    re:/\bprato/i,                        bg:'#FF7777',tx:_TX,label:'Pratos'},
  {k:'default',   re:/(?:)/,                            bg:'#D0D0D0',tx:_TX,label:''}
];
function getCol(ann){for(const c of COLS){if(c.re.test(ann||''))return c;}return COLS[COLS.length-1];}

// ── INSTRUMENT ICONS (used in legend & sheet section headers) ──
const INST_ICONS={
  HiHat:'🎩', Pausa:'⏸', Tribal:'🪘', Surdo:'🥁', Ride:'🔔', Caixa:'🎯', Bumbo:'💥',
  'Marcação':'📍', 'Acentuação':'❗', Crescente:'📈', Aro:'⭕', Virada:'🔄', Pratos:'🎶'
};
function getIcon(label){return INST_ICONS[label]||'🎵';}
