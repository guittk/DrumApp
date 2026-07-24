// ════════════════════════════════════════════════════════
//  OPENAI — busca automática de BPM/Duração
// ════════════════════════════════════════════════════════
let _openAiKeyCache=null;
async function getOpenAiKey(){
  if(_openAiKeyCache) return _openAiKeyCache;
  const fromDb=await fbGetConfig('openAiKey');
  if(fromDb){_openAiKeyCache=fromDb;return fromDb;}
  return null;
}
async function changeOpenAiKey(){
  const key=prompt('Nova chave da API da OpenAI:');
  if(key){
    _openAiKeyCache=key.trim();
    await fbSetConfig('openAiKey',_openAiKeyCache);
  }
}

async function fetchBpmDuration(songName){
  const key=await getOpenAiKey();
  if(!key) throw new Error('Nenhuma chave da API configurada no Firebase (config em "openAiKey").');
  const res=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({
      model:'gpt-4o-mini',
      messages:[
        {role:'system',content:'Você responde APENAS com um JSON estrito no formato {"bpm":<inteiro>,"duration":"m:ss"} com o BPM típico e a duração aproximada da música informada. Sem texto adicional.'},
        {role:'user',content:`Música: ${songName}`}
      ],
      temperature:0.2
    })
  });
  if(!res.ok){
    const errText=await res.text().catch(()=>'');
    throw new Error(`Erro na API OpenAI (${res.status}): ${errText.slice(0,200)}`);
  }
  const data=await res.json();
  const content=data.choices?.[0]?.message?.content||'';
  const match=content.match(/\{[\s\S]*\}/);
  if(!match) throw new Error('Resposta inesperada da API.');
  const parsed=JSON.parse(match[0]);
  return {bpm:parseInt(parsed.bpm)||null,duration:parsed.duration||null};
}

// ── Modal de comparação ─────────────────────────────────
// core: name, curBpm, curDuration, onApplyBpm(v), onApplyDuration(v)
let bpmModalTarget=null;
function openBpmSearchModalCore(name,curBpm,curDuration,onApplyBpm,onApplyDuration){
  name=(name||'').trim();
  if(!name){alert('Digite o nome da música primeiro.');return;}
  bpmModalTarget={onApplyBpm,onApplyDuration};
  const modal=document.getElementById('bpm-modal');
  const body=document.getElementById('bpm-modal-body');
  body.innerHTML=`<div class="bpm-modal-loading">Buscando BPM e duração de "${esc(name)}"…</div>`;
  modal.classList.remove('hidden');
  fetchBpmDuration(name).then(res=>{
    body.innerHTML=`
      <div class="bpm-modal-row">
        <div class="bpm-modal-col"><span class="bpm-modal-lbl">BPM atual</span><span class="bpm-modal-val">${esc(curBpm||'—')}</span></div>
        <div class="bpm-modal-col"><span class="bpm-modal-lbl">BPM encontrado</span><span class="bpm-modal-val accent">${res.bpm??'—'}</span></div>
      </div>
      <div class="bpm-modal-row">
        <div class="bpm-modal-col"><span class="bpm-modal-lbl">Duração atual</span><span class="bpm-modal-val">${esc(curDuration||'—')}</span></div>
        <div class="bpm-modal-col"><span class="bpm-modal-lbl">Duração encontrada</span><span class="bpm-modal-val accent">${esc(res.duration||'—')}</span></div>
      </div>
      <div class="bpm-modal-actions">
        ${res.bpm?`<button class="pill-btn" onclick="applyBpmResult('bpm',${res.bpm})">Usar novo BPM</button>`:''}
        ${res.duration?`<button class="pill-btn" onclick="applyBpmResult('duration','${esc(res.duration)}')">Usar nova duração</button>`:''}
        <button class="pill-btn" onclick="closeBpmModal()">Manter atual</button>
      </div>`;
  }).catch(err=>{
    body.innerHTML=`<div class="bpm-modal-error">${esc(err.message)}</div>
      <div class="bpm-modal-actions"><button class="pill-btn" onclick="closeBpmModal()">Fechar</button></div>`;
  });
}
function applyBpmResult(field,value){
  if(!bpmModalTarget)return;
  if(field==='bpm')bpmModalTarget.onApplyBpm(value);
  else bpmModalTarget.onApplyDuration(value);
}
function closeBpmModal(){document.getElementById('bpm-modal').classList.add('hidden');bpmModalTarget=null;}

// Editor (Nova/Editar Música)
function openBpmSearchModal(nameInputId,bpmInputId,durationInputId){
  const nameEl=document.getElementById(nameInputId);
  const bpmEl=document.getElementById(bpmInputId);
  const durEl=document.getElementById(durationInputId);
  openBpmSearchModalCore(nameEl.value,bpmEl.value,durEl?durEl.value:'',
    v=>{bpmEl.value=v;},
    v=>{if(durEl)durEl.value=v;});
}

// Visualização da música (já salva)
function openBpmSearchModalForSong(){
  if(!cur)return;
  openBpmSearchModalCore(cur.name,cur.bpm,cur.duration,
    v=>{cur.bpm=v;saveAll();renderSong();},
    v=>{cur.duration=v;saveAll();renderSong();});
}
