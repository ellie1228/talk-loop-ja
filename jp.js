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

// ---------- 글자 크게 (50대 사용자 배려) ----------
(() => {
  const btn = document.createElement('button');
  btn.id = 'bigText'; btn.className = 'bigbtn'; btn.type = 'button';
  const set = on => { document.body.classList.toggle('big', on); btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? '가 글자 보통' : '가+ 글자 크게'; try { localStorage.setItem('loop-big', on ? '1' : '0'); } catch {} };
  btn.onclick = () => set(!document.body.classList.contains('big'));
  document.querySelector('header .brand').after(btn);
  let on = false; try { on = localStorage.getItem('loop-big') === '1'; } catch {}
  set(on);
})();

// ---------- 처음 한 번 쓰는 법 안내 ----------
(() => {
  const box = document.createElement('div');
  box.id = 'guide'; box.className = 'guide'; box.hidden = true;
  box.innerHTML = `<div class="guide-card" role="dialog" aria-labelledby="guideTitle"><h2 id="guideTitle">이렇게 연습해요</h2><ol>
    <li><b>한국어</b> 문장을 봐요.</li><li>일본어로 <b>소리 내어</b> 말해 봐요. 몰라도 괜찮아요.</li>
    <li><b>정답 확인</b>을 누르면 일본어·읽는 법·<b>한글 발음</b>이 나오고 소리도 나요. 따라 말해 보세요.</li>
    <li>바로 말했으면 <b>○ 바로 말했어요</b>, 막혔으면 <b>✕ 아직 막혀요</b>. 막힌 문장은 더 자주 나와요.</li></ol>
    <p class="muted">글씨가 작으면 맨 위 <b>가+ 글자 크게</b>를 눌러 주세요. 손을 쓰기 어려울 땐 <b>▶ 툭툭 넘기기</b>로 듣기만 해도 돼요.</p>
    <button id="guideClose" class="primary wide">시작하기</button></div>`;
  document.body.append(box);
  const close = () => { box.hidden = true; try { localStorage.setItem('loop-guide', '1'); } catch {} };
  box.querySelector('#guideClose').onclick = close;
  box.onclick = e => { if (e.target === box) close(); };
  const link = document.createElement('button');
  link.type = 'button'; link.className = 'textbutton'; link.textContent = '❔ 쓰는 법 보기';
  link.onclick = () => { box.hidden = false; };
  document.querySelector('#practice aside')?.append(link);
  let seen = false; try { seen = localStorage.getItem('loop-guide') === '1'; } catch {}
  if (!seen) box.hidden = false;
})();
