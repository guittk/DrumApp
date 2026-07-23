// ════════════════════════════════════════════════════════
//  DRUM SYNTHESIS
// ════════════════════════════════════════════════════════
let audioCtx=null;

function getCtx(){
  if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}

function synthKick(ctx,t){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(40,t+0.35);
  g.gain.setValueAtTime(1.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
  o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.5);
}
function synthSnare(ctx,t){
  const n=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.15),ctx.sampleRate);
  const d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();src.buffer=n;
  const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=3500;bp.Q.value=0.5;
  const ng=ctx.createGain();ng.gain.setValueAtTime(0.8,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.15);
  src.connect(bp);bp.connect(ng);ng.connect(ctx.destination);src.start(t);src.stop(t+0.2);
  const o=ctx.createOscillator(),og=ctx.createGain();
  o.type='triangle';o.frequency.value=250;og.gain.setValueAtTime(0.5,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.1);
  o.connect(og);og.connect(ctx.destination);o.start(t);o.stop(t+0.15);
}
function synthHihat(ctx,t,open){
  const dur=open?0.28:0.055;
  const n=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
  const d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();src.buffer=n;
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=8000;
  const g=ctx.createGain();g.gain.setValueAtTime(0.5,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  src.connect(hp);hp.connect(g);g.connect(ctx.destination);src.start(t);src.stop(t+dur+0.01);
}
function synthRide(ctx,t){
  const dur=0.6;
  const n=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
  const d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();src.buffer=n;
  const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=5000;bp.Q.value=0.3;
  const g=ctx.createGain();g.gain.setValueAtTime(0.35,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  src.connect(bp);bp.connect(g);g.connect(ctx.destination);src.start(t);src.stop(t+dur+0.01);
}
function synthTom(ctx,t){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(90,t+0.3);
  g.gain.setValueAtTime(1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
  o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.4);
}
function synthSurdo(ctx,t){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(50,t+0.5);
  g.gain.setValueAtTime(1.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
  o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.7);
}
