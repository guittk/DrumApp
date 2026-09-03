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
let tickEnabled=false; // toca um tick de metrônomo no ritmo do BPM enquanto o play está piscando
let playStartSec=0; // instante (linha do tempo por BPM ou Tempo) do bloco marcado — ⏮ e play voltam pra cá
let curElapsedSec=0; // instante atual nessa linha do tempo — avança com o play, usado pra centralizar o bloco atual
let songBeatSections=[]; // [{t0,t1,pattern,totalSteps,secPerStep}] — blocos com ritmo salvo
let beatSoundEnabled=false; // toca o som real da batida (não só o tick) durante o play
let blockMeta=[]; // [{bars,lineCount,eb,el,t0,t1,centerY}] — um por bloco da música atual, na ordem da tela
let currentBlockIdx=-1; // índice do bloco centralizado agora (evita re-centralizar a cada frame sem trocar)
