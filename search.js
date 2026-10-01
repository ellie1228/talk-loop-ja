// 문장 목록 탭 맨 위 '전체 검색': 기초·응용·업무 영어·단어를 한 번에 찾는다.
// 한국어·영어·같이 정답·상황 설명·비슷한 표현·예문까지 본다. ▷로 바로 들을 수 있다.
'use strict';
const SEARCH_LIMIT = 8;
const searchOpen = new Set();
function searchIndex() {
  const deckName = id => DECKS.find(d => d.id === id)?.title || '내 표현';
  const biz = typeof BIZ_CARDS !== 'undefined' ? BIZ_CARDS : [];
  return [
    { key: 'basic', title: '기초 말하기', items: cards().filter(c => !c.image).map(c => ({ ko: c.ko, en: c.en, tag: deckName(c.deck), extra: [...(c.alt || []), c.context, ...(c.similar || []).flatMap(s => [s.en, s.ko])] })) },
    { key: 'drill', title: '응용', items: DRILL_LIST.map(d => d.type === 'A' ? { ko: d.ko, en: d.en, tag: 'A · ' + d.frame, extra: [d.cue, ...(d.alt || [])] }
      : d.type === 'B' ? { ko: d.baseKo + ' → ' + d.dir, en: d.en, tag: 'B · 문장 변형', extra: [d.base, ...(d.alt || [])] }
      : { ko: d.ko, en: d.en, tag: 'C · 한 문장 더', extra: [d.context, ...(d.examples || [])] }) },
    { key: 'biz', title: '업무 영어', items: biz.map(c => ({ ko: c.ko, en: c.en, tag: BIZ.decks.find(x => x.id === c.deck)?.title || '', extra: [...(c.alt || []), c.context] })) },
    { key: 'word', title: '단어', items: WORD_LIST.map(w => ({ ko: (w.emoji ? w.emoji + ' ' : '') + w.ko, en: w.en, tag: (window.WORD_CATS || []).find(c => c.id === w.cat)?.title || '', extra: [...(w.alt || []), w.hint, w.sentence?.en, w.sentence?.ko] })) },
  ];
}
const norm = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'");
function highlight(text, q) {
  const s = String(text || ''), i = norm(s).indexOf(q);
  return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
}
let searchTimer = null, searchHits = [];
function runSearch() {
  const q = norm($('gsearch').value.trim());
  if (!q) { $('gsearchResults').innerHTML = ''; $('gsearchInfo').hidden = true; return; }
  searchHits = [];
  let total = 0;
  const html = searchIndex().map(g => {
    const hits = g.items.filter(it => [it.ko, it.en, it.tag, ...it.extra].some(v => norm(v).includes(q)));
    if (!hits.length) return '';
    total += hits.length;
    const shown = searchOpen.has(g.key) ? hits : hits.slice(0, SEARCH_LIMIT);
    const rows = shown.map(it => { const i = searchHits.push(it.en) - 1; return `<div class="srow"><div><p class="tag">${esc(it.tag)}</p><p>${highlight(it.ko, q)}</p><p class="en" lang="ja">${highlight(it.en, q)}</p></div><button class="mini" data-splay="${i}" aria-label="${esc(it.en)} 듣기">▷</button></div>`; }).join('');
    const more = hits.length > shown.length ? `<button class="more" data-smore="${g.key}">${hits.length - shown.length}개 더 보기</button>` : '';
    return `<section class="sgroup"><h3>${g.title} <small>${hits.length}개</small></h3>${rows}${more}</section>`;
  }).join('');
  $('gsearchResults').innerHTML = html;
  $('gsearchInfo').hidden = false;
  $('gsearchInfo').textContent = total ? `'${$('gsearch').value.trim()}' 검색 결과 ${total}개` : `'${$('gsearch').value.trim()}'이(가) 들어간 문장이 없어요. 다른 말로 찾아보세요.`;
}
$('gsearch').addEventListener('input', () => { clearTimeout(searchTimer); searchOpen.clear(); searchTimer = setTimeout(runSearch, 150); });
$('gsearchResults').addEventListener('click', e => {
  const p = e.target.closest('[data-splay]'); if (p) playText(searchHits[+p.dataset.splay]);
  const m = e.target.closest('[data-smore]'); if (m) { searchOpen.add(m.dataset.smore); runSearch(); }
});
