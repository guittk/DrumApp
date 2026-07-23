// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════
(async function init(){
  const dz=document.getElementById('drop-zone');
  ['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag-over');}));
  document.addEventListener('dragleave',e=>{if(!dz.contains(e.relatedTarget))dz.classList.remove('drag-over');});
  document.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag-over');readFile(e.dataTransfer.files[0]);});
  document.getElementById('file-input').addEventListener('change',e=>{if(e.target.files[0])readFile(e.target.files[0]);});

  loadStore(); applyFs();

  if(songs.length){goList();}
  else{
    await Promise.race([tryAutoLoad(),new Promise(r=>setTimeout(r,800))]);
    if(!songs.length) show('screen-upload');
  }
})();

// VH fix — most reliable iOS viewport height approach
function setVH(){document.documentElement.style.setProperty('--vh',window.innerHeight*.01+'px');}
setVH();
window.addEventListener('resize',setVH);
window.addEventListener('orientationchange',()=>setTimeout(setVH,120));
