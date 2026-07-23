// ════════════════════════════════════════════════════════
//  TEXT UTILS
// ════════════════════════════════════════════════════════
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function boldify(raw){
  return esc(raw)
    .replace(/\[([^\]]*)\]/g,'<strong>[$1]</strong>')
    .replace(/\(([^)]*)\)/g,'<strong>($1)</strong>');
}
