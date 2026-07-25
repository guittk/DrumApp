// ════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════
const MOBILE=window.innerWidth<=768;
const CACHE_VER='v5';
let songs=[], favs=new Set(), cur=null;
let fs=MOBILE?22:16, weekMode=false;
let playing=false, rafId=null, ps=null;
let scrollMode='time'; // 'time' (duração manual) ou 'bpm' (duração automática a partir do BPM)
let songTimelineSec=0; // duração total da música calculada por BPM/compasso/compassos (0 = sem BPM, sem highlight)
