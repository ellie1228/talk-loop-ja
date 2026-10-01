// 일본어판(Talk Loop 日本語) 전용: 정답을 '한자+후리가나 + 한글 발음'으로 보여주고, 일본어 음성 인식·비교를 쓴다.
// 영어판에는 넣지 않는다. 카드 필드: en(일본어 문장), ruby('駅[えき]は…'), kana(히라가나 읽기), pron(한글 발음)
'use strict';
const rubyHtml = s => esc(s || '').replace(/([㐀-鿿々〆ヵヶ]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
const jpHtml = c => c ? `<span class="jp" lang="ja">${rubyHtml(c.ruby || c.en)}</span>${c.pron ? `<span class="pron">${esc(c.pron)}</span>` : ''}` : '';
const findCard = id => cards().find(c => c.id === id);

// 정답 화면(말하기·듣기·단어)에 후리가나와 한글 발음
next = (orig => (...a) => { orig(...a); if (current) $('english').innerHTML = jpHtml(current); })(next);
listenNext = (orig => (...a) => { orig(...a); if (L.current) { $('listenEn').innerHTML = jpHtml(L.current); $('listenPreview').innerHTML = jpHtml(L.current); } })(listenNext);
wordNext = (orig => (...a) => { orig(...a); if (W.current) $('wordEn').innerHTML = jpHtml(W.current); })(wordNext);
// 함수를 직접 물고 있던 버튼은 감싼 함수로 다시 연결
$('skip').onclick = () => next();
$('wordSkip').onclick = () => wordNext();
// 문장 보기 목록에도 같은 표시
viewDeck = (orig => (...a) => { orig(...a); document.querySelectorAll('#deckViewList [data-play]').forEach(b => { const c = findCard(b.dataset.play); const s = b.closest('.phrase')?.querySelector('strong'); if (c && s) s.innerHTML = jpHtml(c); }); })(viewDeck);

// 일본어 비교: 문장부호·공백을 빼고, 가타카나는 히라가나로 바꿔 문장·같이 정답·읽기(kana)와 맞춰 본다
const jaNorm = s => String(s || '').normalize('NFKC').replace(/[\s。、，．,.！!？?・「」『』…ー〜~]/g, '').replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 96));
compare = (text, c) => { const t = jaNorm(text); return !!t && [c.en, ...(c.alt || []), c.kana].some(a => jaNorm(a) === t); };

// 응용(영어 문법 드릴)은 일본어판에 없다
window.EXTRA_PROGRESS = [];
$('modeDrill').hidden = true;
$('modeDrill').closest('.seg').hidden = true;
// 첫 카드가 이 파일보다 먼저 그려졌으면(느린 연결) 다시 그린다
if (typeof current !== 'undefined' && current) $('english').innerHTML = jpHtml(current);
