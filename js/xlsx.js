// ════════════════════════════════════════════════════════
//  XLSX IMPORT — lê um .xlsx nativamente (por dentro é só um
//  .zip de XMLs) pra pegar a cor REAL de cada célula. O CSV não
//  carrega cor nenhuma (o app precisa adivinhar via tag); o xlsx
//  carrega, e é isso que permite a tela ficar idêntica à planilha.
// ════════════════════════════════════════════════════════

// ── ZIP: só o essencial pra achar e descomprimir entradas pelo
//    nome, usando o diretório central (confiável mesmo quando o
//    cabeçalho local não traz o tamanho, o que o zip do Excel evita
//    mas o de outros geradores às vezes faz). ────────────────────
function readU16LE(b,o){return b[o]|(b[o+1]<<8);}
function readU32LE(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
function textDecoderUtf8(bytes){return new TextDecoder('utf-8').decode(bytes);}

function findEOCD(bytes){
  const sig=0x06054b50;
  const start=Math.max(0,bytes.length-65557);
  for(let i=bytes.length-22;i>=start;i--){
    if(readU32LE(bytes,i)===sig) return i;
  }
  throw new Error('Arquivo .xlsx inválido (fim do zip não encontrado).');
}
function readZipDirectory(bytes){
  const eocd=findEOCD(bytes);
  const cdOffset=readU32LE(bytes,eocd+16);
  const cdEntries=readU16LE(bytes,eocd+10);
  const dir=new Map();
  let p=cdOffset;
  for(let i=0;i<cdEntries;i++){
    if(readU32LE(bytes,p)!==0x02014b50) break;
    const method=readU16LE(bytes,p+10);
    const compSize=readU32LE(bytes,p+20);
    const fnLen=readU16LE(bytes,p+28);
    const exLen=readU16LE(bytes,p+30);
    const cmLen=readU16LE(bytes,p+32);
    const localOffset=readU32LE(bytes,p+42);
    const name=textDecoderUtf8(bytes.subarray(p+46,p+46+fnLen));
    dir.set(name,{method,compSize,localOffset});
    p+=46+fnLen+exLen+cmLen;
  }
  return dir;
}
async function inflateEntry(bytes,entry){
  const lp=entry.localOffset;
  const fnLen=readU16LE(bytes,lp+26);
  const exLen=readU16LE(bytes,lp+28);
  const dataStart=lp+30+fnLen+exLen;
  const data=bytes.subarray(dataStart,dataStart+entry.compSize);
  if(entry.method===0) return data;
  if(entry.method!==8) throw new Error('Compressão do .xlsx não suportada.');
  const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZipText(bytes,dir,name){
  const entry=dir.get(name);
  if(!entry) return null;
  return textDecoderUtf8(await inflateEntry(bytes,entry));
}

// ── XML: decodificar entidades (&amp; &#231; etc) ───────────
function decodeXmlEntities(s){
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g,(m,e)=>{
    if(e==='amp')return '&';if(e==='lt')return '<';if(e==='gt')return '>';
    if(e==='quot')return '"';if(e==='apos')return "'";
    if(e[1]==='x')return String.fromCodePoint(parseInt(e.slice(2),16));
    return String.fromCodePoint(parseInt(e.slice(1),10));
  });
}

// ── sharedStrings.xml → array de textos (por índice) ────────
function parseSharedStrings(xml){
  if(!xml) return [];
  const out=[];
  const siRe=/<si>([\s\S]*?)<\/si>/g;
  let m;
  while((m=siRe.exec(xml))){
    const parts=[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(p=>decodeXmlEntities(p[1]));
    out.push(parts.join(''));
  }
  return out;
}

// ── theme1.xml → 12 cores na ordem que fgColor theme="N" usa
//    (lt1,dk1,lt2,dk2,accent1..6,hlink,folHlink — o Excel troca
//    dk1/lt1 de posição em relação ao <clrScheme>; é assim mesmo). ──
function parseTheme(xml){
  const dflt=['FFFFFF','000000','E7E6E6','44546A','4472C4','ED7D31','A5A5A5','FFC000','5B9BD5','70AD47','0563C1','954F72'];
  if(!xml) return dflt;
  const m=xml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/);
  if(!m) return dflt;
  const order=['dk1','lt1','dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
  const found={};
  order.forEach((key,i)=>{
    const tm=m[1].match(new RegExp(`<a:${key}>\\s*<a:(?:srgbClr val|sysClr[^>]*lastClr)="([0-9A-Fa-f]{6})"`));
    found[key]=tm?tm[1].toUpperCase():dflt[i];
  });
  return ['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'].map(k=>found[k]);
}

// ── tint de cor de tema — mesma matemática do Excel: ajusta a
//    luminância em HSL (não os canais RGB direto), daí converte de volta. ──
function hexToRgb(hex){const n=parseInt(hex,16);return [(n>>16)&255,(n>>8)&255,n&255];}
function rgbToHex(r,g,b){return [r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();}
function rgbToHls(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
  if(max===min) return [0,l,0];
  const d=max-min,s=l>0.5?d/(2-max-min):d/(max+min);
  let h;
  if(max===r)h=(g-b)/d+(g<b?6:0);
  else if(max===g)h=(b-r)/d+2;
  else h=(r-g)/d+4;
  return [h/6,l,s];
}
function hue2rgb(p,q,t){
  if(t<0)t+=1;if(t>1)t-=1;
  if(t<1/6)return p+(q-p)*6*t;
  if(t<1/2)return q;
  if(t<2/3)return p+(q-p)*(2/3-t)*6;
  return p;
}
function hlsToRgb(h,l,s){
  if(s===0){const v=l*255;return [v,v,v];}
  const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
  return [hue2rgb(p,q,h+1/3)*255,hue2rgb(p,q,h)*255,hue2rgb(p,q,h-1/3)*255];
}
function applyTint(hex,tint){
  if(!tint) return hex;
  const [h,l,s]=rgbToHls(...hexToRgb(hex));
  const l2=tint<0?l*(1+tint):l*(1-tint)+tint;
  return rgbToHex(...hlsToRgb(h,l2,s));
}

// ── styles.xml → resolve o índice de estilo de uma célula (o
//    atributo s="N") na cor de preenchimento real (hex sem #). ──
function parseStyles(xml,theme){
  if(!xml) return {fillForXf:()=>null};
  const fillsBlock=xml.match(/<fills[^>]*>([\s\S]*?)<\/fills>/);
  const fills=fillsBlock?[...fillsBlock[1].matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map(m=>m[1]):[];
  const fillHex=fills.map(f=>{
    const pf=f.match(/<patternFill[^>]*patternType="([^"]*)"/);
    if(!pf||pf[1]!=='solid') return null;
    const fg=f.match(/<fgColor([^/]*)\/>/);
    if(!fg) return null;
    const rgbM=fg[1].match(/rgb="([0-9A-Fa-f]{8})"/);
    if(rgbM) return rgbM[1].slice(2).toUpperCase(); // ARGB -> RGB (descarta o alfa)
    const themeM=fg[1].match(/theme="(\d+)"/);
    if(themeM){
      const tintM=fg[1].match(/tint="(-?[\d.]+)"/);
      return applyTint(theme[+themeM[1]]||'FFFFFF',tintM?parseFloat(tintM[1]):0);
    }
    return null;
  });
  const xfsBlock=xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
  const xfs=xfsBlock?[...xfsBlock[1].matchAll(/<xf\b[^>]*\/?>/g)].map(m=>{
    const fm=m[0].match(/fillId="(\d+)"/);
    return fm?+fm[1]:0;
  }):[];
  return {fillForXf(xfIdx){const fillId=xfs[xfIdx];return fillId!=null?fillHex[fillId]:null;}};
}

// ── workbook.xml + rels → planilhas visíveis com seu arquivo
//    dentro do zip (a coluna "target" vem do rId, não da ordem). ──
function parseWorkbookSheets(workbookXml,relsXml){
  const rels={};
  [...(relsXml||'').matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)].forEach(m=>{rels[m[1]]=m[2];});
  const sheets=[];
  [...(workbookXml||'').matchAll(/<sheet\b([^>]*)\/>/g)].forEach(m=>{
    const attrs=m[1];
    const name=attrs.match(/name="([^"]*)"/);
    const state=attrs.match(/state="([^"]*)"/);
    const rid=attrs.match(/r:id="([^"]+)"/);
    if(name&&rid) sheets.push({name:decodeXmlEntities(name[1]),hidden:!!(state&&state[1]==='hidden'),target:rels[rid[1]]});
  });
  return sheets;
}

// ── worksheet XML → grade esparsa {linha:{coluna:{text,bg}}} ──
function colLettersToNum(letters){
  let n=0;
  for(let i=0;i<letters.length;i++) n=n*26+(letters.charCodeAt(i)-64);
  return n;
}
function parseSheetGrid(xml,sharedStrings,styles){
  const sdM=xml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if(!sdM) return {};
  const grid={};
  const rowRe=/<row [^>]*r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm;
  while((rm=rowRe.exec(sdM[1]))){
    const rowNum=+rm[1],content=rm[2];
    if(!content) continue;
    const cellRe=/<c r="([A-Z]+)\d+"(?:\s+s="(\d+)")?(?:\s+t="(\w+)")?\s*(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    const rowObj={};
    while((cm=cellRe.exec(content))){
      const [,colLetters,style,type,inner]=cm;
      let text='';
      if(inner){
        if(type==='inlineStr'){
          text=[...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(p=>decodeXmlEntities(p[1])).join('');
        }else{
          const vm=inner.match(/<v>([\s\S]*?)<\/v>/);
          const raw=vm?vm[1]:'';
          text=type==='s'?(sharedStrings[+raw]||''):decodeXmlEntities(raw);
        }
      }
      const bg=style!=null?styles.fillForXf(+style):null;
      rowObj[colLettersToNum(colLetters)]={text,bg};
    }
    grid[rowNum]=rowObj;
  }
  return grid;
}

// ── grade → músicas, no MESMO formato de items que o parseCSV
//    produz (find nameRow, colunas com nome, itens a partir de
//    nameRow+2) — só muda de onde vem bg/tx: da célula real, não
//    de uma tag adivinhada por regex. ─────────────────────────
function extractSongsFromGrid(grid){
  const rowNums=Object.keys(grid).map(Number).sort((a,b)=>a-b);
  if(!rowNums.length) return [];
  const maxRow=rowNums[rowNums.length-1];
  let nameRow=-1,best=0;
  for(let r=rowNums[0];r<=Math.min(rowNums[0]+40,maxRow);r++){
    const row=grid[r];if(!row) continue;
    const n=Object.values(row).filter(c=>c.text.trim()&&!c.text.trim().startsWith('[')).length;
    if(n>best){best=n;nameRow=r;}
  }
  if(nameRow<0) return [];
  const cols=[];
  Object.entries(grid[nameRow]).forEach(([col,cell])=>{
    const n=cell.text.trim();
    if(n&&!n.startsWith('[')) cols.push({name:n,col:+col});
  });
  if(!cols.length) return [];
  const start=nameRow+2;
  return cols.map(({name,col})=>{
    const items=[];
    let prevEmpty=true;
    for(let r=start;r<=maxRow;r++){
      const cell=grid[r]&&grid[r][col];
      const text=(cell&&cell.text||'').trim();
      if(!text){ if(!prevEmpty) items.push({type:'empty'}); prevEmpty=true; continue; }
      prevEmpty=false;
      if(text.startsWith('[')){
        const exact=!!cell.bg;
        const bg=exact?'#'+cell.bg:getCol(text).bg;
        const tx=exact?contrastText(bg):getCol(text).tx;
        items.push({type:'ann',text,bg,tx,exact});
      }else{
        items.push({type:'lyric',text,accent:'#7fa37a'});
      }
    }
    while(items.length&&items[items.length-1].type==='empty') items.pop();
    const cnt={};
    items.filter(x=>x.type==='ann').forEach(x=>{cnt[x.bg]=(cnt[x.bg]||0)+1;});
    const dom=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0]||'#7fa37a';
    const sections=items.filter(x=>x.type==='ann').length;
    return {name,items,dom,sections,bpm:null};
  });
}

// ── ponto de entrada: ArrayBuffer do .xlsx → músicas no mesmo
//    formato que parseCSV produz. Varre todas as planilhas visíveis
//    e usa as que têm células [Tag] — não depende do nome da aba. ──
async function parseXLSX(buf){
  const bytes=new Uint8Array(buf);
  const dir=readZipDirectory(bytes);
  const sharedStrings=parseSharedStrings(await readZipText(bytes,dir,'xl/sharedStrings.xml'));
  const theme=parseTheme(await readZipText(bytes,dir,'xl/theme/theme1.xml'));
  const styles=parseStyles(await readZipText(bytes,dir,'xl/styles.xml'),theme);
  const workbookXml=await readZipText(bytes,dir,'xl/workbook.xml');
  const relsXml=await readZipText(bytes,dir,'xl/_rels/workbook.xml.rels');
  if(!workbookXml) throw new Error('Não achei o workbook dentro do .xlsx — arquivo corrompido ou formato inesperado.');
  const sheets=parseWorkbookSheets(workbookXml,relsXml);
  const songs=[];
  for(const sheet of sheets){
    if(sheet.hidden||!sheet.target) continue;
    const path='xl/'+sheet.target.replace(/^\/?(xl\/)?/,'');
    const sheetXml=await readZipText(bytes,dir,path);
    if(!sheetXml) continue;
    const grid=parseSheetGrid(sheetXml,sharedStrings,styles);
    const looksLikeSongSheet=Object.values(grid).some(row=>Object.values(row).some(c=>/^\[.+\]/.test(c.text.trim())));
    if(!looksLikeSongSheet) continue;
    songs.push(...extractSongsFromGrid(grid));
  }
  return songs;
}
