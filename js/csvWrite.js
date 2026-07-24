// ════════════════════════════════════════════════════════
//  CSV WRITE-BACK (File System Access API, com fallback)
// ════════════════════════════════════════════════════════
let csvFileHandle=null;

function csvWriteSupported(){return typeof window.showOpenFilePicker==='function';}

async function connectCsvFile(){
  if(!csvWriteSupported()){
    alert('Seu navegador não suporta conectar diretamente ao arquivo. As alterações serão baixadas como musicas.csv — substitua o arquivo manualmente.');
    return;
  }
  try{
    const [handle]=await window.showOpenFilePicker({types:[{description:'CSV',accept:{'text/csv':['.csv']}}]});
    csvFileHandle=handle;
    const file=await handle.getFile();
    const text=await file.text();
    processCSV(text);
    updateCsvStatus();
  }catch(e){ if(e && e.name!=='AbortError') console.error(e); }
}

function updateCsvStatus(){
  const el=document.getElementById('csv-connect-btn');
  if(!el)return;
  el.textContent=csvFileHandle?'🔗 CSV conectado':'🔗 Conectar CSV';
  el.classList.toggle('active',!!csvFileHandle);
}

function downloadCsvFallback(text){
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='musicas.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

async function writeCsvBack(){
  const text=serializeCSV(songs);
  if(csvFileHandle){
    try{
      const writable=await csvFileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    }catch(e){console.error(e);}
  }
  downloadCsvFallback(text);
}
