// 단어 탭 · 듣기 탭 · 툭툭 넘기기(자동 진행) 모드.
// app.js의 전역(data, save, uid, cards, esc, summary, stopAudio, modelAudio, next, reveal …)을 그대로 쓴다.
'use strict';
const WORD_LIST = (window.WORDS || []).map(w => ({ ...w, id: 'w-' + w.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 음성 재생: 미리 만든 모범 음성이 있으면 그 파일, 없으면 기기 목소리. 끝나면 resolve.
function playText(en, rate = 1) {
  const file = window.AUDIO?.files?.[en.trim()];
  window.speechSynthesis?.cancel();
  if (file) {
    modelAudio = modelAudio || new Audio();
    modelAudio.pause();
    modelAudio.src = window.AUDIO_DATA?.[file] ? 'data:audio/mpeg;base64,' + window.AUDIO_DATA[file] : 'audio/' + file;
    modelAudio.playbackRate = rate; modelAudio.preservesPitch = true; modelAudio.webkitPreservesPitch = true;
    return new Promise(res => { modelAudio.onended = res; modelAudio.onerror = res; modelAudio.play().catch(res); });
  }
  if (!window.speechSynthesis) return Promise.resolve();
  return new Promise(res => { const u = new SpeechSynthesisUtterance(en); u.lang = 'ja-JP'; u.rate = rate; u.onend = res; u.onerror = res; speechSynthesis.speak(u); });
}

async function logResult(cardId, correct, ms, kind) {
  data.logs.push({ id: uid(), cardId, time: new Date().toISOString(), correct, source: 'self', heard: '', ms: Math.round(ms), assisted: false, autoCorrect: null, kind });
  try { await save(); } catch {}
  updateToday();
}

// 가중치로 다음 카드 고르기: 처음 보는 카드·최근 틀린 카드가 더 자주 나온다.
function pickNext(pool, order, state, statFor) {
  if (!pool.length) return null;
  // 새 카드만: 남은 새 카드를 앞에서부터(건너뛴 카드는 잠시 뒤로)
  if (order === 'new') { const f = pool.find(c => !state.recent.includes(c.id)) || pool[0]; state.recent = [...state.recent, f.id].slice(-3); return f; }
  if (order === 'sequence') return pool[state.seq++ % pool.length];
  const fresh = pool.filter(c => !state.recent.includes(c.id));
  const cand = fresh.length ? fresh : pool;
  const w = cand.map(c => { const s = statFor(c.id); return !s.tries ? 4 : !s.last.correct ? 8 : s.stable ? 1 : 3; });
  let roll = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < w.length - 1 && (roll -= w[i]) > 0) i++;
  state.recent = [...state.recent, cand[i].id].slice(-Math.min(4, pool.length - 1));
  return cand[i];
}
// 말하기와 같은 기준: 최근 3번 연속 O + 서로 다른 3일에 5초 안에 O
const statOf = kind => id => {
  const logs = logsByCard().get(kind + '|' + id) || [], last = logs.slice(-3);
  const days = new Set(logs.filter(x => x.correct && x.ms <= 5000).map(x => new Date(x.time).toLocaleDateString())).size;
  return { tries: logs.length, wrong: logs.filter(x => !x.correct).length, last: logs.at(-1), lastTwo: logs.slice(-2), days, stable: last.length === 3 && last.every(x => x.correct) && days >= 3 };
};

// 말하기 기록에 듣기·단어 기록이 섞이지 않게 한다.
// 기록이 쌓여도 느려지지 않게, 카드별 기록을 한 번만 나눠 두고 기록이 바뀔 때만 다시 나눈다.
const logIndex = { key: '', byCard: new Map() };
function logsByCard() {
  const key = data.logs.length + ':' + (data.logs.at(-1)?.id || '');
  if (logIndex.key !== key) { logIndex.key = key; logIndex.byCard = new Map(); for (const x of data.logs) { const k = (x.kind || 'speak') + '|' + x.cardId; if (!logIndex.byCard.has(k)) logIndex.byCard.set(k, []); logIndex.byCard.get(k).push(x); } }
  return logIndex.byCard;
}
summary = (orig => id => { const all = data.logs; data.logs = logsByCard().get('speak|' + id) || []; try { return orig(id); } finally { data.logs = all; } })(summary);

// ---------- 툭툭 넘기기 공통 ----------
const AUTO_BTN = { practice: 'autoPractice', words: 'autoWords', listen: 'autoListen' };
const auto = { on: null, token: 0, lock: null };
async function wake(on) {
  try { if (on && !auto.lock && navigator.wakeLock) auto.lock = await navigator.wakeLock.request('screen'); if (!on && auto.lock) { await auto.lock.release(); auto.lock = null; } } catch { auto.lock = null; }
}
function stopAuto() {
  if (!auto.on) return;
  const btn = $(AUTO_BTN[auto.on]);
  btn.textContent = '▶ 툭툭 넘기기'; btn.classList.remove('running');
  auto.on = null; auto.token++; wake(false);
}
async function runAuto(tab, step) {
  if (auto.on === tab) { stopAuto(); stopAudio(); return; }
  stopAuto(); auto.on = tab; const token = ++auto.token;
  const btn = $(AUTO_BTN[tab]);
  btn.textContent = '■ 멈추기'; btn.classList.add('running'); wake(true);
  while (auto.on === tab && auto.token === token) { await step(() => auto.on === tab && auto.token === token); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAuto(); });

// ---------- 말하기 탭: 툭툭 넘기기 ----------
$('autoPractice').onclick = () => runAuto('practice', async alive => {
  if (!current) return stopAuto();
  if (shown) next();
  const gap = +$('autoPracticeGap').value * 1000;
  $('countdown').textContent = '툭툭 넘기기 중 · 일본어로 말해 보세요';
  await sleep(gap); if (!alive()) return;
  const ac = $('autovoice').checked; $('autovoice').checked = false; reveal(); $('autovoice').checked = ac;
  await playText(current.en); if (!alive()) return;
  await sleep(1500); if (!alive()) return;
  next();
});

// ---------- 단어 탭 ----------
const W = { current: null, shown: false, started: 0, state: { seq: 0, recent: [] } };
const wordStat = statOf('word');
function wordPool() {
  const cat = $('wordCat').value, kind = $('wordKind').value, order = $('wordOrder').value;
  let a = WORD_LIST.filter(w => cat === 'all' || w.cat === cat);
  if (kind === 'action') a = a.filter(w => w.kind === 'action'); else if (kind === 'thing') a = a.filter(w => w.kind !== 'action');
  if (order === 'wrong') a = a.filter(w => { const s = wordStat(w.id); return s.wrong && !s.stable; });
  if (order === 'new') a = a.filter(w => !wordStat(w.id).tries);
  return a;
}
function wordImage(w) {
  const m = window.WORD_IMAGES?.[w.en]; if (!m) return null;
  const data = window.WORD_IMG_DATA?.[m.file];
  return { ...m, src: data ? 'data:image/jpeg;base64,' + data : 'word-img/' + m.file };
}
function wordCredit() {
  let el = $('wordCredit');
  if (!el) { el = document.createElement('p'); el.id = 'wordCredit'; el.className = 'credit'; $('wordEmoji').after(el); }
  return el;
}
function wordNext() {
  const pool = wordPool(); W.shown = false;
  $('wordAnswer').hidden = true; $('wordGrading').hidden = true; $('wordReveal').hidden = false;
  const w = W.current = pickNext(pool, $('wordOrder').value, W.state, wordStat);
  if (!w) { $('wordEmoji').textContent = '🙂'; $('wordAsk').textContent = '이 조건에 맞는 단어가 없어요.'; $('wordHint').textContent = ''; $('wordPos').textContent = ''; return; }
  const cat = (window.WORD_CATS || []).find(c => c.id === w.cat);
  $('wordCatName').textContent = cat ? cat.emoji + ' ' + cat.title : '';
  $('wordPos').textContent = (pool.indexOf(w) + 1) + ' / ' + pool.length;
  // 사진이 있으면 사진(영어판), 없으면 이모지. 사진 아래에 만든 사람·라이선스를 작게 표시한다.
  const pic = wordImage(w);
  $('wordEmoji').classList.toggle('has-photo', !!pic);
  if (pic) { $('wordEmoji').innerHTML = `<img src="${pic.src}" alt="${esc(w.ko)}">`; } else { $('wordEmoji').textContent = w.emoji; }
  wordCredit().innerHTML = pic ? `사진: <a href="${esc(pic.page_url)}" target="_blank" rel="noopener">${esc(pic.creator)}</a> · ${esc(pic.license)}` : '';
  // 이모지만으로 헷갈리지 않게 그림 바로 아래에 한국어 뜻(기본 켜짐). 끄면 힌트가 있는 단어만 힌트 표시.
  $('wordHint').textContent = $('wordKo').checked ? w.ko : (w.hint || '');
  $('wordHint').classList.toggle('ko', $('wordKo').checked);
  $('wordKoText').hidden = $('wordKo').checked;
  $('wordAsk').textContent = w.kind === 'action' ? '이 동작을 일본어로?' : '일본어로?';
  $('wordEn').textContent = w.en; $('wordKoText').textContent = w.ko;
  const s = w.sentence;
  $('wordLink').hidden = !($('wordSentence').checked && s?.en);
  if (s?.en) { $('wordSentEn').textContent = s.en; $('wordSentKo').textContent = s.ko; }
  W.started = performance.now();
}
function wordReveal(sound = true) {
  if (!W.current || W.shown) return; W.shown = true; W.ms = performance.now() - W.started;
  $('wordAnswer').hidden = false; $('wordGrading').hidden = false; $('wordReveal').hidden = true;
  if (sound) playText(W.current.en);
}
async function wordGrade(ok) {
  if (!W.current || !W.shown) return;
  const w = W.current; W.current = null;
  await logResult(w.id, ok, W.ms, 'word');
  $('wordCount').innerHTML = WORD_LIST.filter(x => wordStat(x.id).stable).length + '<small>/' + WORD_LIST.length + '</small>';
  wordNext();
}
$('wordCat').innerHTML = '<option value="all">모든 장면 섞기</option>' + (window.WORD_CATS || []).map(c => `<option value="${esc(c.id)}">${esc(c.emoji + ' ' + c.title)} (${WORD_LIST.filter(w => w.cat === c.id).length})</option>`).join('');
['wordCat', 'wordKind', 'wordOrder', 'wordKo', 'wordSentence'].forEach(id => $(id).onchange = () => { W.state = { seq: 0, recent: [] }; wordNext(); });
$('wordReveal').onclick = () => wordReveal();
$('wordRight').onclick = () => wordGrade(true);
$('wordWrong').onclick = () => wordGrade(false);
$('wordSkip').onclick = wordNext;
$('wordListen').onclick = () => W.current && playText(W.current.en);
$('wordSentPlay').onclick = () => W.current?.sentence?.en && playText(W.current.sentence.en);
$('autoWords').onclick = () => runAuto('words', async alive => {
  if (!W.current || W.shown) wordNext();
  if (!W.current) return stopAuto();
  await sleep(+$('autoWordsGap').value * 1000); if (!alive()) return;
  wordReveal(false); await playText(W.current.en); if (!alive()) return;
  if ($('wordSentence').checked && W.current.sentence?.en) { await sleep(500); if (!alive()) return; await playText(W.current.sentence.en); if (!alive()) return; }
  await sleep(1200); if (!alive()) return;
  wordNext();
});

// ---------- 듣기 탭 ----------
const L = { current: null, shown: false, started: 0, state: { seq: 0, recent: [] } };
const listenStat = statOf('listen');
const MODE_INFO = {
  meaning: '일본어 소리만 나와요. 뜻을 떠올린 뒤 정답을 확인하고 O/X를 눌러요.',
  shadow: '소리를 들으면서 바로 따라 말해요. 채점 없이 다음 문장으로 넘어가요.',
  answer: '질문을 듣고 일본어로 대답해 보세요. 뜻을 확인하고 O/X를 눌러요.',
};
function listenPool() {
  const deck = $('listenDeck').value, mode = $('listenMode').value;
  let a = cards().filter(c => !c.image && (deck === 'all' || c.deck === deck));
  if (mode === 'answer') a = a.filter(c => /\?\s*$/.test(c.en));
  return a;
}
async function listenPlay() {
  if (!L.current) return;
  const n = $('listenMode').value === 'shadow' ? +$('listenRepeat').value : 1, rate = +$('listenRate').value;
  const c = L.current;
  for (let i = 0; i < n && L.current === c; i++) { await playText(c.en, rate); if (i < n - 1) await sleep(Math.max(1500, c.en.length * 70)); }
  if (L.current === c && L.heardAt == null) L.heardAt = performance.now();
}
function listenNext(play = true) {
  const mode = $('listenMode').value; L.shown = false;
  $('listenModeInfo').textContent = MODE_INFO[mode];
  $('listenRepeatLabel').hidden = mode !== 'shadow';
  $('listenTextLabel').hidden = mode !== 'shadow';
  const pool = listenPool();
  const c = L.current = pickNext(pool, 'smart', L.state, listenStat);
  $('listenAnswer').hidden = true; $('listenGrading').hidden = true;
  if (!c) { $('listenAsk').textContent = '이 조건에 맞는 문장이 없어요.'; $('listenReveal').hidden = true; $('listenNext').hidden = true; return; }
  $('listenDeckName').textContent = DECKS.find(d => d.id === c.deck)?.title || '내 표현';
  $('listenPos').textContent = pool.length + '문장';
  $('listenEn').textContent = c.en; $('listenKo').textContent = c.ko + (c.context ? ' · ' + c.context : '');
  $('listenPreview').textContent = c.en;
  $('listenPreview').hidden = !(mode === 'shadow' && $('listenText').checked);
  $('listenAsk').textContent = mode === 'shadow' ? '들으면서 바로 따라 말해 보세요.' : mode === 'answer' ? '질문을 듣고 일본어로 대답해 보세요.' : '무슨 뜻일까요? ▶를 눌러 다시 들을 수 있어요.';
  $('listenReveal').hidden = mode === 'shadow'; $('listenNext').hidden = mode !== 'shadow';
  if (mode === 'shadow') { $('listenAnswer').hidden = false; }
  L.started = performance.now(); L.heardAt = null;
  if (play) listenPlay();
}
function listenReveal() {
  if (!L.current || L.shown || $('listenMode').value === 'shadow') return; L.shown = true;
  // 소리를 끝까지 듣기 전에 정답을 열면 '바로 알아들음'으로 치지 않는다.
  L.ms = L.heardAt == null ? 60000 : performance.now() - L.heardAt;
  $('listenAnswer').hidden = false; $('listenGrading').hidden = false; $('listenReveal').hidden = true;
}
async function listenGrade(ok) {
  if (!L.current || !L.shown) return;
  const c = L.current; L.current = null;
  await logResult(c.id, ok, L.ms, 'listen');
  listenNext();
}
$('listenDeck').innerHTML = '<option value="all">모든 묶음 섞기</option>' + DECKS.map(d => `<option value="${esc(d.id)}">${esc(d.title)}</option>`).join('');
['listenMode', 'listenDeck'].forEach(id => $(id).onchange = () => { L.state = { seq: 0, recent: [] }; listenNext(false); });
$('listenText').onchange = () => { $('listenPreview').hidden = !$('listenText').checked; };
$('listenPlay').onclick = listenPlay;
$('listenReveal').onclick = listenReveal;
$('listenRight').onclick = () => listenGrade(true);
$('listenWrong').onclick = () => listenGrade(false);
$('listenNext').onclick = () => listenNext();
$('listenSkip').onclick = () => listenNext();
$('autoListen').onclick = () => runAuto('listen', async alive => {
  if (!L.current || L.shown) listenNext(false);
  if (!L.current) return stopAuto();
  await listenPlay(); if (!alive()) return;
  await sleep(+$('autoListenGap').value * 1000); if (!alive()) return;
  if ($('listenMode').value !== 'shadow') { listenReveal(); await sleep(2500); if (!alive()) return; }
  listenNext(false);
});

// ---------- 기록 탭: 단계별 진행 ----------
// 기록 탭 한 줄: 막대 + 단계별 개수와 비율 + [새 카드 연습하기]
const PROGRESS_ROWS = [];
function progressRow(name, list, stat, unit, startNew) {
  const n = levelCounts(list, stat), total = list.length || 1, pct = k => { const v = Math.round(n[k] / total * 100); return n[k] && !v ? '1% 미만' : v + '%'; };
  const idx = PROGRESS_ROWS.push(startNew) - 1;
  return `<div class="row-lv"><b>${name} <small>${list.length}${unit}</small></b>${levelBar(n, list.length)}<span class="legend">${['mastered', 'familiar', 'learning', 'new'].map(k => `<span>${LEVELS[k].dot} ${LEVELS[k].name} ${n[k]} (${pct(k)})</span>`).join('')}</span>${startNew && n.new ? `<button class="lvbtn" data-progressnew="${idx}">⚪ 새 카드 ${n.new}${unit === '개' ? '개' : '장'} 연습하기</button>` : ''}</div>`;
}
function startNewIn(tab, orderId, extra) {
  const el = $(orderId); el.value = 'new';
  setTab(tab); extra?.(); el.dispatchEvent(new Event('change'));
}
function renderProgress() {
  PROGRESS_ROWS.length = 0;
  const legend = '<div class="lv-legend"><span>🟢 <b>완전히 외움</b> 최근 3번 연속 O + 서로 다른 3일에 5초 안에 O</span><span>🟡 <b>익숙함</b> 최근 2번 연속 O</span><span>🟠 <b>연습 중</b> 해봤지만 아직 연속 O가 부족하거나 마지막에 X</span><span>⚪ <b>새 카드</b> 아직 안 해봄</span></div>';
  const rows = [
    progressRow('기초 말하기', cards().filter(c => !c.image), summary, '문장', () => startNewIn('practice', 'order', () => { setSpeakMode('basic'); $('deck').value = 'all'; $('stage').value = 'ordered'; refreshPatterns(); })),
    ...(window.EXTRA_PROGRESS || []).map(f => f()),
    progressRow('단어', WORD_LIST, wordStat, '개', () => startNewIn('words', 'wordOrder', () => { $('wordCat').value = 'all'; $('wordKind').value = 'all'; })),
    progressRow('듣기', cards().filter(c => !c.image), listenStat, '문장', null),
  ].join('');
  $('progress').innerHTML = '<h2>얼마나 외웠나</h2>' + legend + rows + '<p class="muted small">완전히 외움은 서로 다른 3일에 맞혀야 해서, 빨라도 3일째부터 올라가요. 듣기는 듣기 탭에서 새 문장이 더 자주 나와요.</p>';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-progressnew]'); if (b) PROGRESS_ROWS[+b.dataset.progressnew]?.();
  const d = e.target.closest('[data-startnew]');
  if (d) { $('deck').value = d.dataset.startnew; $('stage').value = 'ordered'; $('order').value = 'new'; seq = 0; recent = []; refreshPatterns(); setTab('practice'); setSpeakMode('basic'); next(); }
});
renderHistory = (orig => () => { orig(); renderProgress(); })(renderHistory);

// ---------- 탭 전환 · 단축키 ----------
setTab = (orig => name => { stopAuto(); orig(name); if (name === 'words' && !W.current) wordNext(); if (name === 'listen' && !L.current) listenNext(false); })(setTab);
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));
document.addEventListener('keydown', e => {
  const tab = !$('words').hidden ? 'words' : !$('listen').hidden ? 'listen' : null;
  if (!tab || /INPUT|TEXTAREA|SELECT|AUDIO|SUMMARY/.test(e.target.tagName) || e.isComposing || e.keyCode === 229 || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.code;
  if (!['Space', 'Digit1', 'Numpad1', 'Digit2', 'Numpad2', 'KeyR', 'ArrowRight'].includes(k)) return;
  e.preventDefault();
  if (tab === 'words') {
    if (k === 'Space') wordReveal(); else if (/1$/.test(k)) wordGrade(false); else if (/2$/.test(k)) wordGrade(true);
    else if (k === 'KeyR' && W.current) playText(W.current.en); else if (k === 'ArrowRight') wordNext();
  } else {
    if (k === 'Space') { if (L.shown || $('listenMode').value === 'shadow') listenPlay(); else listenReveal(); }
    else if (/1$/.test(k)) listenGrade(false); else if (/2$/.test(k)) listenGrade(true);
    else if (k === 'KeyR') listenPlay(); else if (k === 'ArrowRight') listenNext();
  }
});
// 그림 단어는 단어 탭으로 옮겼으므로 말하기 탭의 '카드 종류'는 숨긴다(내 표현 그림 카드는 그대로 나온다).
$('visual').value = 'mixed'; $('visual').closest('label').hidden = true;
$('wordCount').innerHTML = WORD_LIST.filter(x => wordStat(x.id).stable).length + '<small>/' + WORD_LIST.length + '</small>';

// 반복 방식 선택을 기억한다(처음엔 '순서대로', 나중에 '오답 우선'으로 바꾸면 그대로 유지).
['order', 'stage', 'drillOrder', 'wordOrder', 'bizOrder'].forEach(id => {
  const el = $(id); if (!el) return;
  try { const v = localStorage.getItem('loop-sel-' + id); if (v && [...el.options].some(o => o.value === v)) el.value = v; } catch {}
  el.addEventListener('change', () => { try { localStorage.setItem('loop-sel-' + id, el.value); } catch {} });
});

// 학습 단계 메뉴에 이 묶음에서 몇 문장이 나오는지 표시한다.
const STAGE_LABEL = { ordered: '전체 · 기초부터 순서대로', core: '기초 필수부터', pattern: '같은 틀로 바꿔 말하기', extended: '상황 확장', all: '모든 단계 섞기' };
function updateStageCounts() {
  const deck = $('deck').value, inDeck = cards().filter(c => deck === 'all' || c.deck === deck);
  const patternIds = new Set(PATTERNS.filter(p => deck === 'all' || p.deck === deck).flatMap(p => p.cardIds));
  const n = { ordered: inDeck.length, all: inDeck.length, core: inDeck.filter(c => (c.stage || 'core') === 'core').length, extended: inDeck.filter(c => c.stage === 'extended').length, pattern: cards().filter(c => patternIds.has(c.id)).length };
  [...$('stage').options].forEach(o => { if (STAGE_LABEL[o.value]) o.textContent = `${STAGE_LABEL[o.value]} (${n[o.value]})`; });
}
refreshPatterns = (orig => () => { orig(); updateStageCounts(); })(refreshPatterns);

// 단어 탭 체크 칸(한국어 뜻·예문 보기) 선택을 기억한다.
['wordKo', 'wordSentence'].forEach(id => {
  const el = $(id); if (!el) return;
  try { const v = localStorage.getItem('loop-chk-' + id); if (v !== null) el.checked = v === '1'; } catch {}
  el.addEventListener('change', () => { try { localStorage.setItem('loop-chk-' + id, el.checked ? '1' : '0'); } catch {} });
});
