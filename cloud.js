// claude.ai 아티팩트에서 열었을 때만 동작한다.
// - 기록·내 표현을 내 계정 전용 저장소(data/users/<id>/)에 저장해 아이폰·PC 기록을 합친다.
// - 아티팩트에서는 마이크가 막혀 있으므로 음성 인식·녹음 버튼을 숨긴다.
// - 백업 내려받기는 아티팩트의 다운로드 기능으로 바꾼다.
(async()=>{
 if(!window.claude?.use)return;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 for(let i=0;i<100&&!$('deck').options.length;i++)await sleep(100);

 $('recordPanel').hidden=true;
 const speechOpt=$('mode').querySelector('option[value="speech"]');
 if(speechOpt){if($('mode').value==='speech'){$('mode').value='fast';next();}speechOpt.remove();}

 const downloads=await claude.use('downloads');
 if(downloads)$('export').onclick=async()=>{
  try{await downloads.save({filename:'english-loop-'+new Date().toISOString().slice(0,10)+'.json',data:JSON.stringify(data,null,2)});$('backupStatus').textContent='다운로드한 파일을 안전한 곳에 보관하세요.';}
  catch{$('backupStatus').textContent='백업 파일을 저장하지 못했어요. 다시 눌러 주세요.';}
 };
 else $('export').hidden=true;

 const sync=document.createElement('p');sync.className='muted';sync.setAttribute('role','status');
 $('export').closest('.panel').querySelector('p').after(sync);
 const show=t=>{sync.textContent=t;};

 const [store,user]=await Promise.all([claude.use('db'),claude.use('user')]);
 const uid=user?await user.id():null;
 if(!store||!uid){show('계정 저장을 사용할 수 없어 이 기기에만 기록돼요.');return;}
 const col=store.collection('data/users/'+uid);
 let device='';try{device=localStorage.getItem('loop-device')||'';if(!device){device=Math.random().toString(36).slice(2,10);localStorage.setItem('loop-device',device);}}catch{device=Math.random().toString(36).slice(2,10);}

 // 다른 기기가 올린 기록 id. 내 기기 문서에는 이 기기에서 새로 생긴 기록만 담는다.
 const others=new Set(),mine=new Map(),cardSent=new Map();
 async function pull(){
  const snap=await col.get();let changed=false;
  const logs=new Map(data.logs.map(l=>[l.id,l])),custom=new Map(data.custom.map(c=>[c.id,c]));
  for(const d of snap.docs){
   const body=d.data();if(!body)continue;
   if(d.id.startsWith('log~')){
    const own=d.id.startsWith('log~'+device+'~');
    if(own)mine.set(d.id,(body.logs||[]).map(l=>l.id).join());
    for(const l of body.logs||[]){if(!own)others.add(l.id);if(!logs.has(l.id)&&validBackup({version:1,custom:[],logs:[l]})){logs.set(l.id,l);changed=true;}}
   }else if(d.id.startsWith('card~')&&body.card){
    const c=body.card,old=custom.get(c.id);cardSent.set(c.id,c.updatedAt||'');
    if(validBackup({version:1,custom:[c],logs:[]})&&(!old||(c.updatedAt||'')>(old.updatedAt||''))){custom.set(c.id,c);changed=true;}
   }
  }
  if(changed){data={version:1,custom:[...custom.values()],logs:[...logs.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time))};await localSave().catch(()=>{});updateToday();if(!$('history').hidden)renderHistory();if(!$('library').hidden)renderLibrary();}
 }
 async function push(){
  const byDay=new Map();
  for(const l of data.logs){if(others.has(l.id))continue;const k='log~'+device+'~'+l.time.slice(0,10);if(!byDay.has(k))byDay.set(k,[]);byDay.get(k).push(l);}
  for(const [k,logs] of byDay){const sig=logs.map(l=>l.id).join();if(mine.get(k)===sig)continue;await col.doc(k).set({logs});mine.set(k,sig);}
  for(const c of data.custom){const v=c.updatedAt||'';if(cardSent.get(c.id)===v)continue;await col.doc('card~'+c.id.replace(/[^A-Za-z0-9_\-.~:@+]/g,'_')).set({card:c});cardSent.set(c.id,v);}
 }
 const localSave=save;let busy=Promise.resolve();
 save=async()=>{
  let localOk=true;try{await localSave();}catch{localOk=false;}
  const run=busy.then(push).then(()=>show('내 계정에 저장됐어요. 아이폰·PC 어디서 열어도 기록이 이어져요.'),e=>{show(e?.code==='quota_exceeded'?'계정 저장 공간이 가득 찼어요. 백업을 내려받아 주세요.':'계정 저장에 실패했어요. 다음 기록 때 다시 시도해요.');if(!localOk)throw e;});
  busy=run.catch(()=>{});
  return run;
 };
 try{show('계정 기록을 불러오는 중이에요…');await pull();await push();show('내 계정에 저장됐어요. 아이폰·PC 어디서 열어도 기록이 이어져요.');}
 catch{show('계정 기록을 불러오지 못했어요. 이 기기 기록은 그대로 남아 있어요.');}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull().catch(()=>{});});
})();
