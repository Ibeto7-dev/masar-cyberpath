let account=null,revision=0,dirty=false,sending=false,conflict=false,syncText='جارٍ الاتصال';
const baseTraining=()=>({minutes:30,lab:false,mastered:false});
const draftKey=()=> 'masar-v2-pending:'+account.user+':'+tabKey;
const tabKey=sessionStorage.getItem('masar-tab')||crypto.randomUUID();sessionStorage.setItem('masar-tab',tabKey);
function applyState(s){L.splice(0,L.length,...s.lessons);db.notes=s.notes;db.training=s.training||baseTraining()}
function statusText(t){syncText=t;const h=el('syncHint');if(h)h.textContent=t}
function readJSON(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
function downloadState(state){const a=document.createElement('a');const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.href=u;a.download='masar-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)}
async function getAccount(){const r=await fetch('/api/account',{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return r.json()}
function remember(){try{localStorage.setItem(draftKey(),JSON.stringify({revision,state:db}))}catch{statusText('تعذّر حفظ نسخة على الجهاز')}}
function queueSync(){if(!account)return;dirty=true;remember();void flush()}
async function flush(){
 if(!dirty||sending||conflict||!account)return;
 sending=true;statusText('جارٍ الحفظ…');
 try{while(dirty){dirty=false;const snap=JSON.stringify(db);
 const r=await fetch('/api/account',{method:'PUT',headers:{'Content-Type':'application/json','X-Expected-Account':account.user},body:'{"revision":'+revision+',"state":'+snap+'}'});
 if(r.status===409){conflict=true;throw Error('conflict')}
 if(!r.ok)throw Error('write');
 revision=(await r.json()).revision;if(dirty)remember();else localStorage.removeItem(draftKey());
 }statusText('متزامن مع حسابك')}catch{dirty=true;remember();statusText(conflict?'تعارض • راجع حسابي':'بانتظار المزامنة');if(conflict&&!modal.open)accountPanel()}finally{sending=false}
}
async function reconcile(){if(!account||sending||modal.open)return;if(dirty){await flush();return}
 try{const a=await getAccount();if(a.user!==account.user){location.reload();return}if(!dirty&&!sending&&a.revision>revision&&!modal.open){revision=a.revision;applyState(a.state);render()}}catch{statusText('تعذّر الاتصال بالحساب')}}
async function boot(){main.innerHTML='<p class="empty">جارٍ فتح خطتك المحفوظة…</p>';try{
 account=await getAccount();revision=account.revision;if(account.state)applyState(account.state);
 let draft=readJSON(draftKey());if(draft&&validState(draft.state)){applyState(draft.state);dirty=true;conflict=draft.revision!==revision}
 render();statusText(conflict?'تعارض • راجع حسابي':'متزامن مع حسابك');if(dirty&&!conflict)await flush();
 if(conflict||(validState(readJSON('masar-v1'))&&!localStorage.getItem('masar-imported:'+account.user)))accountPanel();
 }catch(e){account=null;main.innerHTML='<section class="panel"><h2>فتح مساحة التعلّم</h2><p class="introline">'+(e.message==='401'?'سجّل الدخول بحساب ChatGPT لفتح خطتك.':'تعذّر تحميل خطتك من الحساب. تحقّق من الاتصال وأعد المحاولة.')+'</p>'+(e.message==='401'?'<a class="btn primary" target="_top" href="/signin-with-chatgpt?return_to=%2F">تسجيل الدخول</a>':'<button class="btn primary" onclick="boot()">إعادة المحاولة</button>')+'</section>'}}
function accountPanel(){const legacy=validState(readJSON('masar-v1')),orphan=Object.keys(localStorage).filter(k=>k.startsWith('masar-v2-pending:'+account.user+':')&&k!==draftKey()&&validState(readJSON(k)?.state));show('<h2>حسابي والمزامنة</h2><p dir="auto">'+esc(account.label)+'</p><p>'+esc(syncText)+'</p><div class="actions"><button class="btn" onclick="downloadState(db)">تنزيل نسخة احتياطية</button><button class="btn" onclick="el(\'restore\').click()">استعادة نسخة</button><input hidden type="file" id="restore" accept=".json,application/json"></div>'+(legacy?'<div class="detail"><b>تقدّم الإصدار الأول على هذا الجهاز</b><p>يمكنك نقل الخطة المحلية كاملة إلى حسابك. احتفظ بنسخة من خطة الحساب الحالية قبل استبدالها.</p><button class="btn" id="importOld">نقل الخطة المحلية</button></div>':'')+(conflict?'<div class="detail"><b>تغيّرت الخطة على جهاز آخر</b><p>نزّل تعديلات هذا الجهاز للاحتفاظ بها، ثم اختر النسخة التي تود المتابعة بها.</p><div class="actions"><button class="btn" id="useCloud">استخدام نسخة الحساب</button><button class="btn" id="useMine">حفظ نسخة هذا الجهاز</button></div></div>':dirty?'<button class="btn" id="retry">إعادة المزامنة</button>':'')+(orphan.length?'<p class="introline">نسخ معلّقة من جلسات أخرى على هذا الجهاز</p>'+orphan.map((_,i)=>'<button class="btn" id="draft'+i+'">تنزيل النسخة '+(i+1)+'</button>').join(''):'')+'<p id="accountMsg" role="status"></p><p><a target="_top" href="/signout-with-chatgpt?return_to=%2F">تسجيل الخروج</a></p>');
 orphan.forEach((k,i)=>el('draft'+i).onclick=()=>downloadState(readJSON(k).state));
 el('restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>1500000)throw Error();const s=JSON.parse(await f.text());if(!validState(s))throw Error();replacePlan(s)}catch{el('accountMsg').textContent='تعذّرت قراءة النسخة. اختر ملف نسخة مسار صالحًا.'}};
 if(legacy)el('importOld').onclick=()=>{if(replacePlan(readJSON('masar-v1')))localStorage.setItem('masar-imported:'+account.user,'1')};
 if(el('retry'))el('retry').onclick=async()=>{await flush();accountPanel()};
 async function resolve(mine){if(!confirm(mine?'استبدال النسخة الأحدث في الحساب بتعديلات هذا الجهاز؟':'اعتماد نسخة الحساب والتخلي عن تعديلات هذه الجلسة؟'))return;
 try{const a=await getAccount();if(a.user!==account.user)throw Error();revision=a.revision;conflict=false;if(mine){queueSync()}else{applyState(a.state||{lessons:structuredClone(initial),notes:[]});dirty=false;localStorage.removeItem(draftKey());statusText('متزامن مع حسابك')}modal.close();render()}catch{el('accountMsg').textContent='تعذّر الاتصال. أعد المحاولة.'}}
 if(conflict){el('useMine').onclick=()=>resolve(true);el('useCloud').onclick=()=>resolve(false)}
}
function replacePlan(s){if(!confirm('استبدال خطة الحساب بهذه النسخة؟'))return false;applyState(structuredClone(s));save();modal.close();render();return true}
window.addEventListener('online',reconcile);window.addEventListener('focus',reconcile);setInterval(()=>{if(!document.hidden)reconcile()},30000);
window.addEventListener('beforeunload',e=>{if(dirty||sending){e.preventDefault();e.returnValue=''}});
