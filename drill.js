// 말하기 탭의 응용 연습(A 틀 바꿔 말하기 · B 문장 변형 · C 한 문장 더).
// 기초 말하기와 화면·기록을 따로 쓴다(기록 kind: 'drill'). extra.js의 도우미를 그대로 쓴다.
'use strict';
const DRILL_LIST = window.DRILLS || [];
const D = { type: 'A', current: null, shown: false, started: 0, state: { seq: 0, recent: [] } };
const drillStat = statOf('drill');
AUTO_BTN.drill = 'autoDrill';
const TYPE_NAME = { A: 'A · 틀 바꾸기', B: 'B · 문장 변형', C: 'C · 한 문장 더' };

// 말하기 탭 위 전환 버튼: basic(기초) · drill(응용) · biz(업무 영어)
const SPEAK_MODES = { basic: ['modeBasic', 'basicWorkspace'], drill: ['modeDrill', 'drillWorkspace'], biz: ['modeBiz', 'bizWorkspace'] };
const SPEAK_ENTER = { basic: () => arm(), drill: () => { if (!D.current) drillNext(); } };
function setSpeakMode(mode) {
  stopAuto(); stopAudio(); clearInterval(timer);
  for (const [m, [btn, ws]] of Object.entries(SPEAK_MODES)) {
    if (!$(btn)) continue;
    $(ws).hidden = m !== mode; $(btn).classList.toggle('on', m === mode); $(btn).setAttribute('aria-selected', String(m === mode));
  }
  try { localStorage.setItem('loop-speak-mode', mode); } catch {}
  SPEAK_ENTER[mode]?.();
  if (typeof restartClocks === 'function') restartClocks();
}
const drillMode = on => setSpeakMode(on ? 'drill' : 'basic');
const inDrill = () => !$('practice').hidden && !$('drillWorkspace').hidden;

function drillPool() {
  const order = $('drillOrder').value;
  let a = DRILL_LIST.filter(d => d.type === D.type);
  if (D.type === 'A' && $('drillFrame').value !== 'all') a = a.filter(d => d.group === $('drillFrame').value);
  if (D.type === 'B' && $('drillDir').value !== 'all') a = a.filter(d => d.group === $('drillDir').value);
  if (order === 'wrong') a = a.filter(d => { const s = drillStat(d.id); return s.wrong && !s.stable; });
  if (order === 'new') a = a.filter(d => !drillStat(d.id).tries);
  return a;
}
// play: 사용자가 채점·건너뛰기로 넘어왔을 때만 C 질문을 읽어준다(탭·종류 전환 때는 조용히).
function drillNext(play = false) {
  const pool = drillPool(); D.shown = false;
  $('drillAnswer').hidden = true; $('drillGrading').hidden = true; $('drillReveal').hidden = false;
  const d = D.current = pickNext(pool, $('drillOrder').value, D.state, drillStat);
  $('drillTag').textContent = TYPE_NAME[D.type];
  ['drillContext', 'drillFrameChip', 'drillMain', 'drillSub', 'drillDirChip'].forEach(id => { $(id).textContent = ''; });
  $('drillPlayQ').hidden = true;
  if (!d) { $('drillMain').textContent = '이 조건에 맞는 카드가 없어요.'; $('drillPos').textContent = ''; return; }
  $('drillPos').textContent = (pool.indexOf(d) + 1) + ' / ' + pool.length;
  if (d.type === 'A') {
    $('drillFrameChip').textContent = d.frame;
    $('drillMain').textContent = d.cue;
    $('drillSub').textContent = '';
  } else if (d.type === 'B') {
    $('drillContext').textContent = '기본 문장';
    $('drillMain').textContent = d.base; $('drillMain').lang = 'en';
    $('drillSub').textContent = d.baseKo;
    $('drillDirChip').textContent = '→ ' + d.dir;
  } else {
    $('drillContext').textContent = d.context;
    $('drillMain').textContent = d.en; $('drillMain').lang = 'en';
    $('drillSub').textContent = d.ko;
    $('drillDirChip').textContent = '대답 + 한 문장 더';
    $('drillPlayQ').hidden = false;
  }
  if (d.type === 'A') $('drillMain').lang = 'ko';
  $('drillEn').textContent = d.type === 'C' ? '모범 답 예시' : d.en;
  $('drillNote').textContent = d.type === 'A' ? d.ko : d.type === 'B' ? d.note : '두 문장 이상 막힘없이 말했으면 O';
  $('drillAlt').hidden = !(d.alt || []).length;
  $('drillAlt').innerHTML = (d.alt || []).length ? `<p><b>같이 정답</b> <span lang="ja">${esc(d.alt.join(' / '))}</span></p>` : '';
  $('drillExamples').hidden = d.type !== 'C';
  $('drillExamples').innerHTML = d.type === 'C' ? d.examples.map((e, i) => `<p><span lang="ja">${esc(e)}</span> <button class="mini" data-ex="${i}" aria-label="예시 ${i + 1} 듣기">▷</button></p>`).join('') : '';
  $('drillListen').hidden = d.type === 'C';
  $('drillWrong').firstChild.textContent = d.type === 'C' ? '✕ 한 문장만 했어요 ' : '✕ 아직 막혀요 ';
  $('drillRight').firstChild.textContent = d.type === 'C' ? '○ 두 문장 말했어요 ' : '○ 바로 말했어요 ';
  D.started = performance.now();
  if (d.type === 'C' && play) playText(d.en);
}
function drillReveal(sound = true) {
  if (!D.current || D.shown) return; D.shown = true; D.ms = performance.now() - D.started;
  $('drillAnswer').hidden = false; $('drillGrading').hidden = false; $('drillReveal').hidden = true;
  if (sound && D.current.type !== 'C') playText(D.current.en);
}
async function drillGrade(ok) {
  if (!D.current || !D.shown) return;
  const d = D.current; D.current = null;
  await logResult(d.id, ok, D.ms, 'drill');
  drillNext(true);
}
function setDrillType(t) {
  D.type = t; D.state = { seq: 0, recent: [] };
  document.querySelectorAll('[data-dtype]').forEach(b => { const on = b.dataset.dtype === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  $('drillFrameLabel').hidden = t !== 'A'; $('drillDirLabel').hidden = t !== 'B';
  stopAuto(); drillNext();
}

$('drillFrame').innerHTML = '<option value="all">20개 틀 섞기</option>' + (window.DRILL_FRAMES || []).map(f => `<option value="${esc(f.id)}">${esc(f.frame)} · ${esc(f.frameKo)}</option>`).join('');
$('modeBasic').onclick = () => drillMode(false);
$('modeDrill').onclick = () => drillMode(true);
document.querySelectorAll('[data-dtype]').forEach(b => b.onclick = () => setDrillType(b.dataset.dtype));
['drillFrame', 'drillDir', 'drillOrder'].forEach(id => $(id).onchange = () => { D.state = { seq: 0, recent: [] }; stopAuto(); drillNext(); });
$('drillReveal').onclick = () => drillReveal();
$('drillRight').onclick = () => drillGrade(true);
$('drillWrong').onclick = () => drillGrade(false);
$('drillSkip').onclick = () => drillNext(true);
$('drillListen').onclick = () => D.current && playText(D.current.en);
$('drillPlayQ').onclick = () => D.current && playText(D.current.en);
$('drillExamples').onclick = e => { const b = e.target.closest('[data-ex]'); if (b && D.current?.examples) playText(D.current.examples[+b.dataset.ex]); };
$('autoDrill').onclick = () => runAuto('drill', async alive => {
  if (!D.current || D.shown) drillNext();
  if (!D.current) return stopAuto();
  const d = D.current;
  if (d.type === 'C') { await playText(d.en); if (!alive()) return; }
  await sleep(+$('autoDrillGap').value * 1000 + (d.type === 'C' ? 3000 : 0)); if (!alive()) return;
  drillReveal(false);
  if (d.type === 'C') { for (const e of d.examples) { await playText(e); if (!alive()) return; await sleep(700); } }
  else await playText(d.en);
  if (!alive()) return;
  await sleep(1500); if (!alive()) return;
  drillNext();
});

// 응용 화면에서는 기초 말하기 단축키 대신 응용 단축키가 동작한다(먼저 받아서 막는다).
document.addEventListener('keydown', e => {
  if (!inDrill() || /INPUT|TEXTAREA|SELECT|AUDIO|SUMMARY/.test(e.target.tagName) || e.isComposing || e.keyCode === 229 || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.code;
  if (!['Space', 'Digit1', 'Numpad1', 'Digit2', 'Numpad2', 'KeyX', 'KeyO', 'KeyR', 'ArrowRight'].includes(k)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (k === 'Space') drillReveal(); else if (/1$|KeyX/.test(k)) drillGrade(false); else if (/2$|KeyO/.test(k)) drillGrade(true);
  else if (k === 'KeyR' && D.current) playText(D.current.type === 'C' && D.shown ? D.current.examples[0] : D.current.en);
  else if (k === 'ArrowRight') drillNext(true);
}, true);

// 기록 탭 진행 막대에 '응용' 줄을 더한다.
(window.EXTRA_PROGRESS = window.EXTRA_PROGRESS || []).push(() => progressRow('응용', DRILL_LIST, drillStat, '장', () => startNewIn('practice', 'drillOrder', () => { setSpeakMode('drill'); })));


