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
