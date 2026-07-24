// ════════════════════════════════════════════════════════
//  CSV PARSER
// ════════════════════════════════════════════════════════
function parseCSV(raw){
  const rows=raw.split(/\r?\n/).map(r=>r.split(';'));
  if(rows.length<12) throw new Error('Arquivo inválido ou muito curto.');
  let nameRow=10,best=0;
  for(let r=0;r<Math.min(20,rows.length);r++){
    const n=rows[r].filter(c=>c.trim()&&!c.trim().startsWith('[')).length;
    if(n>best){best=n;nameRow=r;}
  }
  const cols=[];
  (rows[nameRow]||[]).forEach((cell,i)=>{
    const n=cell.trim();
    if(n&&!n.startsWith('[')) cols.push({name:n,i});
  });
  if(!cols.length) throw new Error('Nenhuma música encontrada. CSV deve usar ; como separador.');
  const lenCount={};
  rows.forEach(r=>{lenCount[r.length]=(lenCount[r.length]||0)+1;});
  const baseLen=+Object.entries(lenCount).sort((a,b)=>b[1]-a[1])[0][0];
  function readCell(row,idx){
    const extra=Math.max(0,row.length-baseLen);
    let cell=(idx<row.length?row[idx]:'').trim();
    if(!cell&&extra>0){
      for(let s=1;s<=extra;s++){const alt=((idx+s)<row.length?row[idx+s]:'').trim();if(alt){cell=alt;break;}}
    }
    return cell;
  }
  const start=nameRow+2;
  return cols.map(({name,i})=>{
    const items=[];
    let lastBg='#D0D0D0',prevEmpty=true;
    for(let r=start;r<rows.length;r++){
      const cell=readCell(rows[r]||[],i);
      if(!cell){if(!prevEmpty)items.push({type:'empty'});prevEmpty=true;}
      else if(cell.startsWith('[')){
        const c=getCol(cell);lastBg=c.bg;
        items.push({type:'ann',text:cell,bg:c.bg,tx:c.tx});prevEmpty=false;
      } else {
        items.push({type:'lyric',text:cell,accent:lastBg});prevEmpty=false;
      }
    }
    while(items.length&&items[items.length-1].type==='empty') items.pop();
    const cnt={};
    items.filter(x=>x.type==='ann').forEach(x=>{cnt[x.bg]=(cnt[x.bg]||0)+1;});
    const dom=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0]||'#D0D0D0';
    const sections=items.filter(x=>x.type==='ann').length;
    return {name,items,dom,sections,bpm:null};
  });
}

// ════════════════════════════════════════════════════════
//  CSV SERIALIZER — gera sempre o layout padrão (10 linhas de
//  topo, linha de nomes, linha em branco, depois as linhas de
//  itens), com uma coluna por música na ordem atual da lista.
//  Não depende de nenhum arquivo importado anteriormente.
// ════════════════════════════════════════════════════════
function serializeCSV(songList){
  const nameRow=10;
  const start=nameRow+2;
  const maxItems=songList.reduce((m,s)=>Math.max(m,(s.items||[]).length),0);
  const rows=[];
  for(let r=0;r<start+maxItems;r++) rows.push(songList.map(()=>''));
  const sanitize=s=>String(s==null?'':s).replace(/;/g,',').replace(/\r?\n/g,' ');
  songList.forEach((song,col)=>{
    rows[nameRow][col]=song.name;
    (song.items||[]).forEach((item,i)=>{
      rows[start+i][col]=item.type==='empty'?'':sanitize(item.text);
    });
  });
  return rows.map(r=>r.join(';')).join('\r\n');
}
