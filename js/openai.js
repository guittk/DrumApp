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
// Para cada campo (BPM / Duração) o usuário escolhe explicitamente
// "Manter atual" ou "Usar encontrado"; um botão único aplica as duas
// escolhas de uma vez.
let bpmModalTarget=null;      // {onApplyBpm(v), onApplyDuration(v)}
let bpmModalCurrent=null;     // {bpm, duration} — valores atuais da música
let bpmModalResult=null;      // {bpm, duration} — valores encontrados pela API
let bpmModalChoice=null;      // {bpm:'keep'|'new', duration:'keep'|'new'}

function openBpmSearchModalCore(name,curBpm,curDuration,onApplyBpm,onApplyDuration){
  name=(name||'').trim();
  if(!name){alert('Digite o nome da música primeiro.');return;}
  bpmModalTarget={onApplyBpm,onApplyDuration};
  bpmModalCurrent={bpm:curBpm||null,duration:curDuration||null};
  bpmModalResult=null;
  bpmModalChoice={bpm:'keep',duration:'keep'};
  const modal=document.getElementById('bpm-modal');
  const body=document.getElementById('bpm-modal-body');
  body.innerHTML=`<div class="bpm-modal-loading">Buscando BPM e duração de "${esc(name)}"…</div>`;
  modal.classList.remove('hidden');
  fetchBpmDuration(name).then(res=>{
    bpmModalResult=res;
    if(res.bpm) bpmModalChoice.bpm='new';
    if(res.duration) bpmModalChoice.duration='new';
    renderBpmModalBody();
  }).catch(err=>{
    body.innerHTML=`<div class="bpm-modal-error">${esc(err.message)}</div>
      <div class="bpm-modal-actions"><button class="pill-btn" onclick="closeBpmModal()">Fechar</button></div>`;
  });
}

function bpmFieldRowHtml(field,label,curVal,newVal){
  const hasNew=newVal!==null&&newVal!==undefined&&newVal!=='';
  const curTxt=(curVal===0||curVal)?curVal:'—';
  const newTxt=hasNew?newVal:'—';
  return `<div class="bpm-modal-row" data-field="${field}">
    <span class="bpm-modal-field-lbl">${esc(label)}</span>
    <div class="bpm-field-choice">
      <button type="button" class="bpm-choice-btn${bpmModalChoice[field]==='keep'?' active':''}" data-field="${field}" data-choice="keep">Manter (${esc(curTxt)})</button>
      <button type="button" class="bpm-choice-btn${hasNew?'':' disabled'}${bpmModalChoice[field]==='new'?' active':''}" data-field="${field}" data-choice="new">Usar encontrado (${esc(newTxt)})</button>
    </div>
  </div>`;
}

function renderBpmModalBody(){
  const body=document.getElementById('bpm-modal-body');
  const res=bpmModalResult||{bpm:null,duration:null};
  body.innerHTML=
    bpmFieldRowHtml('bpm','BPM',bpmModalCurrent.bpm,res.bpm)+
    bpmFieldRowHtml('duration','Duração',bpmModalCurrent.duration,res.duration)+
    `<div class="bpm-modal-actions">
      <button class="pill-btn" id="bpm-confirm-btn">✓ Aplicar</button>
      <button class="pill-btn" id="bpm-cancel-btn">Cancelar</button>
    </div>`;
  body.querySelectorAll('.bpm-choice-btn:not(.disabled)').forEach(btn=>{
    btn.addEventListener('click',()=>{
      bpmModalChoice[btn.dataset.field]=btn.dataset.choice;
      renderBpmModalBody();
    });
  });
  document.getElementById('bpm-confirm-btn').addEventListener('click',confirmBpmModal);
  document.getElementById('bpm-cancel-btn').addEventListener('click',closeBpmModal);
}

function confirmBpmModal(){
  if(!bpmModalTarget||!bpmModalResult)return;
  if(bpmModalChoice.bpm==='new'&&bpmModalResult.bpm) bpmModalTarget.onApplyBpm(bpmModalResult.bpm);
  if(bpmModalChoice.duration==='new'&&bpmModalResult.duration) bpmModalTarget.onApplyDuration(bpmModalResult.duration);
  closeBpmModal();
}
function closeBpmModal(){
  document.getElementById('bpm-modal').classList.add('hidden');
  bpmModalTarget=null;bpmModalCurrent=null;bpmModalResult=null;bpmModalChoice=null;
}

// Editor (Nova/Editar Música)
function openBpmSearchModal(nameInputId,bpmInputId,durationInputId){
  const nameEl=document.getElementById(nameInputId);
  const bpmEl=document.getElementById(bpmInputId);
  const durEl=document.getElementById(durationInputId);
  openBpmSearchModalCore(nameEl.value,bpmEl.value?parseInt(bpmEl.value):null,durEl?durEl.value:'',
    v=>{bpmEl.value=v;},
    v=>{if(durEl)durEl.value=v;});
}

// Visualização da música (já salva)
function openBpmSearchModalForSong(){
  if(!cur)return;
  openBpmSearchModalCore(cur.name,cur.bpm,cur.duration,
    v=>{cur.bpm=v;saveAll();fbSaveSong(cur);renderSong();},
    v=>{cur.duration=v;saveAll();fbSaveSong(cur);renderSong();});
}
