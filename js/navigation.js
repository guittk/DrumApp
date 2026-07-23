// ════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════
const SCREENS=['screen-upload','screen-list','screen-song','screen-editor','screen-drum'];
function show(id){SCREENS.forEach(s=>document.getElementById(s).classList.toggle('hidden',s!==id));}
function goUpload(){stopPlay();show('screen-upload');}
function goList(){stopPlay();stopDrumPlay();show('screen-list');renderList();}
function goSong(s){if(!s)return;cur=s;show('screen-song');renderSong();}
