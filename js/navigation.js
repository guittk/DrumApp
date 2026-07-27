// ════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════
const SCREENS=['screen-upload','screen-list','screen-song','screen-editor','screen-drum','screen-tags','screen-csv-diff'];
function show(id){SCREENS.forEach(s=>document.getElementById(s).classList.toggle('hidden',s!==id));}
function goUpload(){
  stopPlay();show('screen-upload');
  document.getElementById('up-back-btn').classList.toggle('hidden',!songs.length);
}
function goList(){stopPlay();stopDrumPlay();show('screen-list');renderList();}
function goSong(s){if(!s)return;cur=s;show('screen-song');renderSong();}

// ── Modal de confirmação interno (substitui window.confirm) ────────────
function showConfirm(text){
  return new Promise(resolve=>{
    const modal=document.getElementById('confirm-modal');
    const textEl=document.getElementById('confirm-modal-text');
    const okBtn=document.getElementById('confirm-modal-ok-btn');
    const cancelBtn=document.getElementById('confirm-modal-cancel-btn');
    textEl.textContent=text;
    modal.classList.remove('hidden');
    function cleanup(result){
      modal.classList.add('hidden');
      okBtn.removeEventListener('click',onOk);
      cancelBtn.removeEventListener('click',onCancel);
      modal.removeEventListener('click',onBackdrop);
      resolve(result);
    }
    function onOk(){cleanup(true);}
    function onCancel(){cleanup(false);}
    function onBackdrop(e){if(e.target===modal)cleanup(false);}
    okBtn.addEventListener('click',onOk);
    cancelBtn.addEventListener('click',onCancel);
    modal.addEventListener('click',onBackdrop);
  });
}
