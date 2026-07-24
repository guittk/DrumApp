// ════════════════════════════════════════════════════════
//  CSV EXPORT — Database → arquivo .csv (mesmo formato do import)
// ════════════════════════════════════════════════════════
function downloadCsvFallback(text){
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='musicas.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

async function exportCsv(){
  const text=serializeCSV(songs);
  if(typeof window.showSaveFilePicker==='function'){
    try{
      const handle=await window.showSaveFilePicker({suggestedName:'musicas.csv',types:[{description:'CSV',accept:{'text/csv':['.csv']}}]});
      const writable=await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    }catch(e){ if(e&&e.name==='AbortError')return; console.error(e); }
  }
  downloadCsvFallback(text);
}
