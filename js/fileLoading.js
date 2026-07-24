// ════════════════════════════════════════════════════════
//  FILE LOADING
// ════════════════════════════════════════════════════════
function decodeBuffer(buf){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(buf));}
  catch(e){return new TextDecoder('iso-8859-1').decode(new Uint8Array(buf));}
}
function processCSV(text){
  const parsed=parseCSV(text);
  if(!parsed.length) throw new Error('Nenhuma música encontrada.');
  // Keep manually created/edited songs; drop CSV versions overridden by an edited copy
  const created=songs.filter(s=>s.created);
  const createdNames=new Set(created.map(s=>s.name));
  songs=[...parsed.filter(s=>!createdNames.has(s.name)),...created]; saveAll(); goList();
}
function readFile(file){
  const err=document.getElementById('up-err');
  err.style.display='none';
  if(!file||!file.name.toLowerCase().endsWith('.csv')){
    err.textContent='Selecione um arquivo .CSV';err.style.display='block';return;
  }
  const reader=new FileReader();
  reader.onload=e=>{
    try{processCSV(decodeBuffer(e.target.result));}
    catch(ex){err.textContent=ex.message;err.style.display='block';}
  };
  reader.readAsArrayBuffer(file);
}
async function tryAutoLoad(){
  for(const url of['./musicas.csv','./Thurgh_IBAV_.csv','./thurgh.csv','./sheet.csv']){
    try{
      const res=await fetch(url,{cache:'no-store'});
      if(res.ok){const t=decodeBuffer(await res.arrayBuffer());const p=parseCSV(t);if(p.length){const c=songs.filter(s=>s.created);const cn=new Set(c.map(s=>s.name));songs=[...p.filter(s=>!cn.has(s.name)),...c];saveAll();goList();return;}}
    }catch(e){}
  }
}
