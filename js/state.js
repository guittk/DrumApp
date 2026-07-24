// ════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════
const MOBILE=window.innerWidth<=768;
const CACHE_VER='v4';
let songs=[], favs=new Set(), cur=null;
let fs=MOBILE?22:16, weekMode=false;
let playing=false, rafId=null, ps=null;
let scrollMode='time'; // 'time' (duração manual) ou 'bpm' (duração automática a partir do BPM)

// ── INSTRUMENT ICONS (used in legend & sheet section headers) ──
const INST_ICONS={
  HiHat:'🎩', Pausa:'⏸', Tribal:'🪘', Surdo:'🥁', Ride:'🔔', Caixa:'🎯', Bumbo:'💥',
  'Marcação':'📍', 'Acentuação':'❗', Crescente:'📈', Aro:'⭕', Virada:'🔄', Pratos:'🎶'
};
function getIcon(label){return INST_ICONS[label]||'🎵';}
