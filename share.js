'use strict';
function restartClocks() { const now = performance.now(); if (current && !shown) started = now; if (D.current && !D.shown) D.started = now; if (W.current && !W.shown) W.started = now; }
setTab = (orig => name => { orig(name); restartClocks(); })(setTab);
document.addEventListener('visibilitychange', () => { if (!document.hidden) restartClocks(); });
$('modeBasic').onclick = () => setSpeakMode('basic');
$('modeDrill').onclick = () => setSpeakMode('drill');
try { const m = localStorage.getItem('loop-speak-mode'); if (m === 'drill') setSpeakMode('drill'); } catch {}
