// ════════════════════════════════════════════════════════
//  CSV IMPORT — comparado contra as músicas do Database
// ════════════════════════════════════════════════════════
function decodeBuffer(buf){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(buf));}
  catch(e){return new TextDecoder('iso-8859-1').decode(new Uint8Array(buf));}
}
function itemsToText(items){return (items||[]).map(it=>it.type==='empty'?'':it.text).join('\n');}
function songsDiffer(a,b){
  return itemsToText(a.items)!==itemsToText(b.items)||(a.bpm||null)!==(b.bpm||null)||(a.duration||null)!==(b.duration||null);
}

// Diff de linhas (LCS) — 'del' só existe no CSV, 'add' só existe no Database
function diffLines(csvText,dbText){
  const a=csvText.split('\n'),b=dbText.split('\n');
  const n=a.length,m=b.length;
  const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
    dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const out=[];let i=0,j=0;
  while(i<n&&j<m){
    if(a[i]===b[j]){out.push({t:'same',v:a[i]});i++;j++;}
    else if(dp[i+1][j]>=dp[i][j+1]){out.push({t:'del',v:a[i]});i++;}
    else{out.push({t:'add',v:b[j]});j++;}
  }
  while(i<n){out.push({t:'del',v:a[i]});i++;}
  while(j<m){out.push({t:'add',v:b[j]});j++;}
  return out;
}

let csvImportFresh=[], csvImportConflicts=[], csvImportChoices={};

function startCsvImport(text){
  const err=document.getElementById('up-err');
  err.style.display='none';
  let parsed;
  try{parsed=parseCSV(text);}catch(ex){err.textContent=ex.message;err.style.display='block';return;}
  if(!parsed.length){err.textContent='Nenhuma música encontrada.';err.style.display='block';return;}

  const byName=new Map(songs.map(s=>[s.name,s]));
  csvImportFresh=[];csvImportConflicts=[];csvImportChoices={};
  parsed.forEach(p=>{
    const existing=byName.get(p.name);
    if(!existing) csvImportFresh.push(p);
    else if(songsDiffer(existing,p)) csvImportConflicts.push({name:p.name,csv:p,db:existing});
  });

  if(!csvImportConflicts.length){
    applyCsvImport();
  }else{
    csvImportConflicts.forEach(c=>{csvImportChoices[c.name]='db';});
    showCsvDiffScreen();
  }
}
function readFile(file){
  const err=document.getElementById('up-err');
  err.style.display='none';
  if(!file||!file.name.toLowerCase().endsWith('.csv')){
    err.textContent='Selecione um arquivo .CSV';err.style.display='block';return;
  }
  const reader=new FileReader();
  reader.onload=e=>startCsvImport(decodeBuffer(e.target.result));
  reader.readAsArrayBuffer(file);
}

// ── Tela de divergências ────────────────────────────────
function showCsvDiffScreen(){
  show('screen-csv-diff');
  document.getElementById('csv-diff-summary').textContent=
    `${csvImportFresh.length} música(s) nova(s) · ${csvImportConflicts.length} com divergência para revisar`;
  const el=document.getElementById('csv-diff-list');
  el.innerHTML=csvImportConflicts.map(c=>{
    const diff=diffLines(itemsToText(c.csv.items),itemsToText(c.db.items));
    const lines=diff.map(d=>`<div class="csv-diff-line${d.t!=='same'?' '+d.t:''}">${esc(d.v)||'&nbsp;'}</div>`).join('');
    return `<div class="csv-diff-item" data-name="${esc(c.name)}">
      <div class="csv-diff-hd">
        <span class="csv-diff-name">${esc(c.name)}</span>
        <div class="csv-diff-choice">
          <button type="button" class="csv-choice-btn active" data-choice="db">Usar Database</button>
          <button type="button" class="csv-choice-btn" data-choice="csv">Usar CSV</button>
        </div>
      </div>
      <div class="csv-diff-body">${lines}</div>
    </div>`;
  }).join('');
  el.querySelectorAll('.csv-diff-item').forEach(item=>{
    const name=item.dataset.name;
    item.querySelectorAll('.csv-choice-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        csvImportChoices[name]=btn.dataset.choice;
        item.querySelectorAll('.csv-choice-btn').forEach(b=>b.classList.toggle('active',b===btn));
      });
    });
  });
}
function cancelCsvImport(){csvImportFresh=[];csvImportConflicts=[];csvImportChoices={};goList();}
function confirmCsvImport(){applyCsvImport();}

function applyCsvImport(){
  const changed=[...csvImportFresh];
  csvImportFresh.forEach(s=>songs.push(s));
  csvImportConflicts.forEach(c=>{
    if(csvImportChoices[c.name]!=='csv')return; // 'db' = manter o que já está
    const idx=songs.indexOf(c.db);
    if(idx>=0)songs[idx]=c.csv;
    changed.push(c.csv);
  });
  csvImportFresh=[];csvImportConflicts=[];csvImportChoices={};
  saveAll();
  fbSaveSongs(changed);
  goList();
}
