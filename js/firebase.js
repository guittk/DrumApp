// ════════════════════════════════════════════════════════
//  FIREBASE (apenas configurações — músicas continuam no CSV)
// ════════════════════════════════════════════════════════
const firebaseConfig={
  apiKey:"AIzaSyBRWp9msUHbf1Hx_uV5cbaSnlUajFpbLyA",
  authDomain:"drumapp-e2351.firebaseapp.com",
  databaseURL:"https://drumapp-e2351-default-rtdb.firebaseio.com",
  projectId:"drumapp-e2351",
  storageBucket:"drumapp-e2351.firebasestorage.app",
  messagingSenderId:"80500642584",
  appId:"1:80500642584:web:af1e381864889b0e32c46d"
};
let fbDb=null;
try{
  firebase.initializeApp(firebaseConfig);
  fbDb=firebase.database();
}catch(e){console.error('Falha ao iniciar Firebase',e);}

function fbGetConfig(path){
  if(!fbDb) return Promise.resolve(null);
  return fbDb.ref(path).once('value').then(snap=>snap.val()).catch(e=>{console.error(e);return null;});
}
function fbSetConfig(path,value){
  if(!fbDb) return Promise.resolve();
  return fbDb.ref(path).set(value).catch(e=>console.error(e));
}

// ════════════════════════════════════════════════════════
//  SONGS — Firebase Realtime Database é a fonte da verdade
// ════════════════════════════════════════════════════════
function songsRef(){return fbDb?fbDb.ref('songs'):null;}
function songKey(name){return encodeURIComponent(name).replace(/\./g,'%2E');}

async function fbLoadSongs(){
  const ref=songsRef();
  if(!ref) return [];
  try{
    const snap=await ref.once('value');
    return Object.values(snap.val()||{});
  }catch(e){console.error(e);return [];}
}
function fbSaveSong(song){
  const ref=songsRef();
  if(!ref||!song) return Promise.resolve();
  return ref.child(songKey(song.name)).set(JSON.parse(JSON.stringify(song))).catch(e=>console.error(e));
}
function fbSaveSongs(list){
  const ref=songsRef();
  if(!ref||!list||!list.length) return Promise.resolve();
  const updates={};
  list.forEach(s=>{updates[songKey(s.name)]=JSON.parse(JSON.stringify(s));});
  return ref.update(updates).catch(e=>console.error(e));
}
function fbDeleteSong(name){
  const ref=songsRef();
  if(!ref) return Promise.resolve();
  return ref.child(songKey(name)).remove().catch(e=>console.error(e));
}
