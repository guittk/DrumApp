// ════════════════════════════════════════════════════════
//  FIREBASE — mesma conta/Firebase do Life OS (Platform), como
//  já funciona em Finanças e Fluência. Dados ficam em
//  /users/{uid}/Bateria, isolados por conta mas no mesmo projeto.
// ════════════════════════════════════════════════════════
const FIREBASE_API_KEY='AIzaSyAQqB__M-gKZWHS4zQ1eIA-X6rGqzVtr0I';
const FIREBASE_DB_URL='https://anki-71f4f-default-rtdb.firebaseio.com';
const SESSION_KEY='thurgh_session';

let session=null; // {idToken, uid, email, expiresAt}

function saveSession(s){session=s;localStorage.setItem(SESSION_KEY,JSON.stringify(s));}
function loadSessionFromStorage(){
  try{
    const raw=localStorage.getItem(SESSION_KEY);
    if(!raw)return null;
    const s=JSON.parse(raw);
    if(!s||!s.idToken||!s.expiresAt||Date.now()>s.expiresAt)return null;
    return s;
  }catch(e){return null;}
}
function clearSession(){session=null;localStorage.removeItem(SESSION_KEY);}
function userPath(sub){return '/users/'+session.uid+'/Bateria'+(sub||'');}

// ── REST (sem SDK) ──────────────────────────────────────
async function fetchWithTimeout(url,options,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs||15000);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
function buildUrl(path){
  const qs=session&&session.idToken?('auth='+session.idToken):'';
  return FIREBASE_DB_URL+path+'.json'+(qs?'?'+qs:'');
}
async function dbGet(path){
  try{
    const res=await fetchWithTimeout(buildUrl(path));
    if(!res.ok)throw new Error('Erro ao ler '+path);
    return await res.json();
  }catch(e){console.error(e);return null;}
}
async function dbPut(path,data){
  try{
    const res=await fetchWithTimeout(buildUrl(path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!res.ok)throw new Error('Erro ao salvar '+path);
    return await res.json();
  }catch(e){console.error(e);}
}
async function dbPatch(path,data){
  try{
    const res=await fetchWithTimeout(buildUrl(path),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!res.ok)throw new Error('Erro ao atualizar '+path);
    return await res.json();
  }catch(e){console.error(e);}
}
async function dbDelete(path){
  try{
    const res=await fetchWithTimeout(buildUrl(path),{method:'DELETE'});
    if(!res.ok)throw new Error('Erro ao apagar '+path);
    return true;
  }catch(e){console.error(e);return false;}
}

// ── Autenticação (Identity Toolkit REST) — mesma conta do Life OS ──
async function identityRequest(email,password){
  const url='https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+FIREBASE_API_KEY;
  const res=await fetchWithTimeout(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email,password,returnSecureToken:true})});
  const data=await res.json();
  if(!res.ok){throw new Error((data.error&&data.error.message)||'Erro desconhecido');}
  return data;
}
function friendlyAuthError(msg){
  const map={
    'EMAIL_NOT_FOUND':'E-mail não encontrado.',
    'INVALID_PASSWORD':'Senha incorreta.',
    'INVALID_LOGIN_CREDENTIALS':'E-mail ou senha incorretos.',
    'MISSING_PASSWORD':'Digite uma senha.',
    'INVALID_EMAIL':'E-mail inválido.'
  };
  for(const k in map){if(msg&&msg.indexOf(k)!==-1)return map[k];}
  return msg||'Não foi possível entrar. Tente novamente.';
}
async function afterLoginSuccess(data){
  saveSession({
    idToken:data.idToken,
    uid:data.localId,
    email:data.email,
    expiresAt:Date.now()+(parseInt(data.expiresIn||'3600',10)*1000)-30000
  });
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  await startApp();
}
function doLogout(){clearSession();location.reload();}

const authEmailEl=document.getElementById('auth-email');
const authPasswordEl=document.getElementById('auth-password');
const authSubmitBtn=document.getElementById('auth-submit-btn');
const authErrorEl=document.getElementById('auth-error');

authPasswordEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();authSubmitBtn.click();}});
authEmailEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();authPasswordEl.focus();}});
authSubmitBtn.addEventListener('click',async()=>{
  const email=authEmailEl.value.trim();
  const password=authPasswordEl.value;
  authErrorEl.classList.remove('active');
  if(!email){authErrorEl.textContent='Digite seu e-mail.';authErrorEl.classList.add('active');return;}
  if(!password){authErrorEl.textContent='Digite sua senha.';authErrorEl.classList.add('active');return;}
  authSubmitBtn.disabled=true;authSubmitBtn.textContent='Entrando…';
  try{
    const data=await identityRequest(email,password);
    await afterLoginSuccess(data);
  }catch(err){
    authErrorEl.textContent=friendlyAuthError(err.message);
    authErrorEl.classList.add('active');
  }finally{
    authSubmitBtn.disabled=false;authSubmitBtn.textContent='Entrar';
  }
});

// ════════════════════════════════════════════════════════
//  CONFIG genérica — raiz do Realtime Database, não por usuário. É onde o
//  Platform também lê a chave da OpenAI compartilhada: dbGet('/openAiKey').
// ════════════════════════════════════════════════════════
function fbGetConfig(path){return dbGet('/'+path);}
function fbSetConfig(path,value){return dbPut('/'+path,value);}

// ════════════════════════════════════════════════════════
//  SONGS — Firebase Realtime Database é a fonte da verdade
// ════════════════════════════════════════════════════════
function songKey(name){return encodeURIComponent(name).replace(/\./g,'%2E');}

async function fbLoadSongs(){
  if(!session)return [];
  const data=await dbGet(userPath('/songs'));
  return Object.values(data||{});
}
function fbSaveSong(song){
  if(!session||!song)return Promise.resolve();
  return dbPut(userPath('/songs/'+songKey(song.name)),JSON.parse(JSON.stringify(song)));
}
function fbSaveSongs(list){
  if(!session||!list||!list.length)return Promise.resolve();
  const updates={};
  list.forEach(s=>{updates[songKey(s.name)]=JSON.parse(JSON.stringify(s));});
  return dbPatch(userPath('/songs'),updates);
}
function fbDeleteSong(name){
  if(!session)return Promise.resolve(false);
  return dbDelete(userPath('/songs/'+songKey(name)));
}

// ── Boot: retoma sessão salva ou fica na tela de login ──
(function initAuth(){
  const restored=loadSessionFromStorage();
  if(restored){
    session=restored;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    startApp();
  }
})();
