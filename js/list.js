// ════════════════════════════════════════════════════════
//  FAVORITES
// ════════════════════════════════════════════════════════
function toggleFav(name){favs.has(name)?favs.delete(name):favs.add(name);saveAll();renderList();if(cur?.name===name)syncFavBtn();}
function toggleFavSong(){if(cur){toggleFav(cur.name);syncFavBtn();}}
function syncFavBtn(){const on=favs.has(cur?.name);const btn=document.getElementById('hd-fav');btn.textContent=on?'★':'☆';btn.classList.toggle('active',on);}
function toggleWeek(){weekMode=!weekMode;saveAll();document.getElementById('week-btn').classList.toggle('active',weekMode);renderList();}

async function deleteSong(name,btn){
  if(!await showConfirm(`Excluir "${name}"? Essa ação não pode ser desfeita.`))return;
  if(btn){btn.disabled=true;btn.textContent='…';}
  // Só remove localmente depois que o servidor confirma — senão um F5 no meio
  // do caminho (ou uma falha de rede) faz a música "voltar", já que o Firebase
  // continua sendo a fonte da verdade e ainda tem ela.
  const ok=await fbDeleteSong(name);
  if(!ok){
    alert('Não foi possível excluir a música. Verifique sua conexão e tente novamente.');
    if(btn){btn.disabled=false;btn.textContent='🗑';}
    return;
  }
  songs=songs.filter(s=>s.name!==name);
  favs.delete(name);
  saveAll();
  renderList();
}

// ════════════════════════════════════════════════════════
//  LIST
// ════════════════════════════════════════════════════════
function renderList(){
  document.getElementById('week-btn').classList.toggle('active',weekMode);
  const q=(document.getElementById('search-in').value||'').toLowerCase().trim();
  const sorted=[...songs].sort((a,b)=>{
    const af=favs.has(a.name)?0:1,bf=favs.has(b.name)?0:1;
    return af!==bf?af-bf:a.name.localeCompare(b.name,'pt');
  });
  const list=sorted.filter(s=>(!weekMode||favs.has(s.name))&&(!q||s.name.toLowerCase().includes(q)));
  const el=document.getElementById('song-list');
  if(!list.length){
    el.innerHTML=`<div class="empty-msg">${weekMode?'Nenhuma música favorita.<br>Toque ☆ para salvar as músicas da semana.':'Nenhuma música encontrada.'}</div>`;
  } else {
    el.innerHTML=list.map(s=>{
      const si=songs.indexOf(s),isFav=favs.has(s.name);
      return `<div class="song-item" data-si="${si}">
        <div class="song-info">
          <div class="song-name${isFav?' is-fav':''}">${esc(s.name)}</div>
          <div class="song-meta">${s.sections} seções${s.bpm?' · '+s.bpm+' BPM':''}</div>
        </div>
        <button class="fav-btn${isFav?' active':''}" data-si="${si}">${isFav?'★':'☆'}</button>
        <button class="del-btn" data-si="${si}" title="Excluir música">🗑</button>
      </div>`;
    }).join('');
    el.querySelectorAll('.song-item').forEach(row=>{
      row.addEventListener('click',e=>{if(e.target.classList.contains('fav-btn')||e.target.classList.contains('del-btn'))return;goSong(songs[+row.dataset.si]);});
    });
    el.querySelectorAll('.fav-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();toggleFav(songs[+btn.dataset.si].name);});
    });
    el.querySelectorAll('.del-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();deleteSong(songs[+btn.dataset.si].name,btn);});
    });
  }
  const nFav=favs.size;
  document.getElementById('list-foot').textContent=`${songs.length} músicas · ${nFav} favorita${nFav!==1?'s':''}`;
}
