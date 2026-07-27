// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════
(function initDomHandlers(){
  const dz=document.getElementById('drop-zone');
  ['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag-over');}));
  document.addEventListener('dragleave',e=>{if(!dz.contains(e.relatedTarget))dz.classList.remove('drag-over');});
  document.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag-over');readFile(e.dataTransfer.files[0]);});
  document.getElementById('file-input').addEventListener('change',e=>{if(e.target.files[0])readFile(e.target.files[0]);});
})();

// Chamado só depois do login (sessão restaurada ou recém-feita) — ver js/firebase.js
async function startApp(){
  loadStore(); applyFs();
  if(songs.length) goList(); // mostra o cache local instantaneamente enquanto busca o Database

  const fresh=await fbLoadSongs();
  if(fresh.length){
    songs=fresh; saveAll(); goList();
  }else if(!songs.length){
    show('screen-upload');
  }
}

// VH fix — most reliable iOS viewport height approach
function setVH(){document.documentElement.style.setProperty('--vh',window.innerHeight*.01+'px');}
setVH();
window.addEventListener('resize',setVH);
window.addEventListener('orientationchange',()=>setTimeout(setVH,120));
