// ════════════════════════════════════════════════════════
//  STORAGE
// ════════════════════════════════════════════════════════
function saveAll(){
  try{
    localStorage.setItem('thurgh_favs',JSON.stringify([...favs]));
    localStorage.setItem('thurgh_fs',String(fs));
    localStorage.setItem('thurgh_week',weekMode?'1':'0');
    localStorage.setItem('thurgh_songs',JSON.stringify({ver:CACHE_VER,data:songs}));
  }catch(e){}
}
function loadStore(){
  try{
    const f=localStorage.getItem('thurgh_favs');if(f)favs=new Set(JSON.parse(f));
    const fz=localStorage.getItem('thurgh_fs');if(fz){fs=parseInt(fz)||fs;if(MOBILE&&fs<20)fs=22;}
    const wk=localStorage.getItem('thurgh_week');if(wk)weekMode=wk==='1';
    const raw=localStorage.getItem('thurgh_songs');
    if(raw){
      const saved=JSON.parse(raw);
      if(saved.ver===CACHE_VER&&saved.data?.length>0&&Array.isArray(saved.data[0].items)){
        songs=saved.data;return true;
      }
      localStorage.removeItem('thurgh_songs');
    }
  }catch(e){}
  return false;
}
