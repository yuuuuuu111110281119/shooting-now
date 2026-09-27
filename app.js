import {mins,hm,normalizeName,stateFor,eventDayISO,findMapForWhere,durationMinutes} from './logic.js';
import {listEvents,putEvent,removeEvent,migrateLegacy} from './db.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>`evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const nowHHMM=()=>{const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};

let BUILTIN=null, EVENTS=[], DATA=null, currentEventId=null;
let selectedTime=nowHHMM(), liveMode=true, currentTab='now';
let selectedMapKey=null, selectedMapArea=null, mapEditMode=false, timetableGroup=null;
let favorites=new Set(JSON.parse(localStorage.getItem('shooting-favorites-v3')||localStorage.getItem('shooting-favorites-v2')||'[]'));
let wizardStep=1, draft=null;

function eventMeta(evt){return evt?.event||{};}
function normalizeEvent(evt){
  if(!evt||typeof evt!=='object') return evt;
  evt.event=evt.event||{};
  evt.event.venue=evt.event.venue||evt.venue||'';
  evt.rule=evt.rule||{shoot1:20,move1:5,shoot2:20,move2:5,cheki:20};
  evt.groups=evt.groups||{}; evt.maps=evt.maps||{}; evt.timetableImages=evt.timetableImages||{};
  for(const [g,gd] of Object.entries(evt.groups)){
    gd.times=gd.times||[]; gd.performers=gd.performers||[];
    gd.performers.forEach(p=>{p.sessions=p.sessions||[];p.performerId=p.performerId||normalizeName(p.name)});
  }
  return evt;
}
function eventLabel(e){const x=eventMeta(e);return `${x.date||''} ${x.title||'名称未設定'}`.trim();}
function performerKey(p){return p.performerId||normalizeName(p.name);}
function saveFavorites(){localStorage.setItem('shooting-favorites-v3',JSON.stringify([...favorites]));render();}
function toggleFavorite(k){favorites.has(k)?favorites.delete(k):favorites.add(k);saveFavorites();}
function isBuiltin(){return DATA?.builtin===true;}
function isEventDay(){return eventMeta(DATA).date===eventDayISO();}
function allPerformers(){const out=[];for(const [group,gd] of Object.entries(DATA?.groups||{})){(gd.performers||[]).forEach((p,index)=>out.push({...p,group,index,groupData:gd}));}return out;}
function stateForPerson(p){return stateFor(p,DATA.groups[p.group],DATA.rule,selectedTime);}
function formatRemaining(st){if(st.remain==null)return ''; if(st.kind==='next')return `開始まで${st.remain}分`; return `あと${st.remain}分`;}
function groupLabel(group){return /group/i.test(group)?group:`${group} GROUP`;}

function setEvent(id){
  const next=EVENTS.find(e=>e.id===id)||BUILTIN;
  DATA=next; currentEventId=next.id; localStorage.setItem('shooting-current-event-v3',currentEventId);
  const mapKeys=Object.keys(DATA.maps||{}); selectedMapKey=mapKeys[0]||null; selectedMapArea=selectedMapKey?(DATA.maps[selectedMapKey].areas||[])[0]??null:null;
  timetableGroup=Object.keys(DATA.groups||{})[0]||null; render();
}

function header(){
  const sel=$('#eventSelect');
  sel.innerHTML=EVENTS.map(e=>`<option value="${esc(e.id)}" ${e.id===currentEventId?'selected':''}>${esc(eventLabel(e))}</option>`).join('');
  const x=eventMeta(DATA);
  $('#eventMeta').textContent=[x.date,x.venue].filter(Boolean).join(' ・ ');
  $('#eventTitle').textContent=x.title||'撮影会 NOW';
  $('#timeInput').value=selectedTime;
  $('#liveBadge').textContent=liveMode?'LIVE':'確認時刻';
  $('#liveBadge').className=`live-badge ${liveMode?'on':''}`;
  $$('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));
}

function renderFavCard(p){
  const st=stateForPerson(p); const mf=findMapForWhere(DATA.maps,st.where);
  return `<article class="fav-card">
    <div class="fav-top"><div><div class="name">${esc(p.name)}</div><div class="meta">${esc(groupLabel(p.group))}${st.sessionLabel?`・${esc(st.sessionLabel)}`:''}</div></div><span class="star-static">★</span></div>
    <div class="status"><span class="badge ${esc(st.kind)}">${esc(st.label)}</span><strong>${mf?`<button class="link-area" data-mapwhere="${esc(st.where)}">${esc(st.where)}</button>`:esc(st.where)}</strong></div>
    ${st.remain!=null?`<div class="countdown">${esc(formatRemaining(st))}</div>`:''}
    ${st.next?`<div class="next">次：${esc(st.next)}</div>`:''}
  </article>`;
}

function renderNow(){
  const rank={shoot:0,move:1,cheki:2,next:3,done:4};
  const favs=allPerformers().filter(p=>favorites.has(performerKey(p))).sort((a,b)=>{const sa=stateForPerson(a),sb=stateForPerson(b);return (rank[sa.kind]??9)-(rank[sb.kind]??9)||(sa.remain??9999)-(sb.remain??9999)||a.name.localeCompare(b.name,'ja');});
  const active=allPerformers().map(p=>({p,st:stateForPerson(p)})).filter(x=>['shoot','move','cheki'].includes(x.st.kind));
  const buckets=new Map();
  for(const x of active){const key=x.st.kind==='move'?'移動中':x.st.where;(buckets.get(key)||buckets.set(key,[]).get(key)).push(x);}
  let h='';
  if(!isEventDay()) h+=`<div class="note">イベント日は <strong>${esc(eventMeta(DATA).date||'未設定')}</strong> です。時刻を変更すると当日の状態を事前確認できます。</div>`;
  h+=`<section class="section"><div class="section-title"><h2>⭐ お気に入り</h2><span class="meta">${esc(selectedTime)}</span></div>${favs.length?`<div class="fav-strip">${favs.map(renderFavCard).join('')}</div>`:'<div class="empty">「出演者」で ☆ を押すと、ここに優先表示されます。</div>'}</section>`;
  h+=`<section class="section"><div class="section-title"><h2>今いる場所</h2><span class="meta">${active.length}人</span></div>`;
  if(!active.length) h+='<div class="empty">この時刻に進行中の出演枠はありません。</div>';
  else h+=`<div class="area-groups">${[...buckets.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ja',{numeric:true})).map(([where,items])=>{
    const mf=findMapForWhere(DATA.maps,where);
    return `<div class="area-card"><div class="area-title"><span>${esc(where)}</span>${mf?`<button class="small-btn" data-mapwhere="${esc(where)}">地図</button>`:''}</div><div class="names">${items.map(({p,st})=>`<button class="person-chip ${favorites.has(performerKey(p))?'favorite':''}" data-person="${esc(performerKey(p))}">${favorites.has(performerKey(p))?'★ ':''}${esc(p.name)} <small>${esc(p.group)}</small>${st.kind==='move'?` <em>${esc(st.where)}</em>`:''}</button>`).join('')}</div></div>`;
  }).join('')}</div>`;
  h+='</section>';
  return h;
}

function scheduleRows(p){
  const gd=DATA.groups[p.group], rows=[];
  (p.sessions||[]).forEach((s,i)=>{if(!s||!gd.times?.[i])return;const t=gd.times[i];rows.push(`<div class="schedule-row"><span>${esc(t.label||`${i+1}部`)}</span><strong>${esc(t.start)}–${esc(t.end||hm(mins(t.start)+durationMinutes(DATA.rule)))}</strong><span>${esc(s.a1||'—')} → ${esc(s.a2||'—')}${s.cheki===false?'':' → チェキ'}</span></div>`)});
  return rows.join('')||'<div class="subtle">出演枠なし</div>';
}

function renderPeople(favOnly=false){
  const q=($('#searchInput')?.value||'').trim().toLowerCase();
  const items=allPerformers().filter(p=>(!favOnly||favorites.has(performerKey(p)))&&(!q||p.name.toLowerCase().includes(q)||p.group.toLowerCase().includes(q)));
  return `<input id="searchInput" class="search" placeholder="出演者名・グループで検索" value="${esc(q)}"><div class="list">${items.map(p=>{
    const key=performerKey(p), st=stateForPerson(p);
    return `<details class="person-details"><summary class="person-row"><button type="button" class="star ${favorites.has(key)?'on':''}" data-fav="${esc(key)}">${favorites.has(key)?'★':'☆'}</button><div class="person-main"><div class="person-name">${esc(p.name)}</div><div class="meta">${esc(groupLabel(p.group))}</div></div><div class="person-state"><span class="badge ${esc(st.kind)}">${esc(st.label)}</span>${st.kind!=='done'?`<small>${esc(st.where)}</small>`:''}</div></summary><div class="schedule-list">${scheduleRows(p)}</div></details>`;
  }).join('')}</div>${items.length?'':'<div class="empty">該当する出演者はいません。</div>'}`;
}

function mapKeyForArea(area){for(const [k,m] of Object.entries(DATA.maps||{})){if((m.areas||[]).some(a=>String(a)===String(area)))return k;}return null;}
function coordFor(map,area){const c=map?.coords?.[String(area)]??map?.coords?.[area];return Array.isArray(c)&&c.length>=2?c:null;}
function mapImage(map){return map?.image||'';}
function renderMap(){
  const maps=DATA.maps||{}, keys=Object.keys(maps); if(!keys.length)return '<div class="empty">会場マップが登録されていません。</div>';
  if(!selectedMapKey||!maps[selectedMapKey])selectedMapKey=keys[0]; const map=maps[selectedMapKey]; const areas=map.areas||[];
  if(selectedMapArea==null||!areas.some(a=>String(a)===String(selectedMapArea)))selectedMapArea=areas[0]??null;
  const xy=coordFor(map,selectedMapArea); const editable=!isBuiltin();
  return `<div class="seg">${keys.map(k=>`<button class="${k===selectedMapKey?'active':''}" data-mapkey="${esc(k)}">${esc(maps[k].label||k)}</button>`).join('')}</div>
    ${mapImage(map)?`<div class="map-wrap ${mapEditMode?'editing':''}" id="mapCanvas"><img src="${esc(mapImage(map))}" alt="${esc(map.label||'会場マップ')}">${xy?`<div class="map-marker" style="left:${Number(xy[0])}%;top:${Number(xy[1])}%">${esc(selectedMapArea)}</div>`:''}${mapEditMode?'<div class="map-edit-hint">地図をタップして位置を設定</div>':''}</div>`:'<div class="empty">マップ画像は保存されていません。</div>'}
    <div class="map-area-buttons">${areas.map(a=>`<button class="${String(a)===String(selectedMapArea)?'active':''}" data-maparea="${esc(a)}">${esc(a)}</button>`).join('')}</div>
    ${editable&&mapImage(map)?`<div class="map-edit-actions"><button id="mapEditBtn" class="secondary">${mapEditMode?'位置編集を終了':'選択エリアの位置を修正'}</button>${xy?'<button id="mapClearBtn" class="secondary">位置を消す</button>':''}</div>`:''}
    <div class="subtle">位置情報は地図上のマーカー表示だけに使います。出演者のNOW判定はタイムテーブル情報から計算します。</div>`;
}

function renderTimetable(){
  const gs=Object.keys(DATA.groups||{}); if(!gs.length)return '<div class="empty">タイムテーブル未登録</div>'; if(!timetableGroup||!gs.includes(timetableGroup))timetableGroup=gs[0];
  const src=DATA.timetableImages?.[timetableGroup]; const gd=DATA.groups[timetableGroup];
  return `<div class="group-tabs">${gs.map(g=>`<button class="${g===timetableGroup?'active':''}" data-tg="${esc(g)}">${esc(g)}</button>`).join('')}</div>${src?`<img class="source-img" src="${esc(src)}" alt="${esc(timetableGroup)} タイムテーブル">`:'<div class="empty">元画像なし</div>'}<div class="panel"><h3>${esc(groupLabel(timetableGroup))}</h3>${(gd.times||[]).map((t,i)=>`<div class="time-line"><span>${esc(t.label||`${i+1}部`)}</span><strong>${esc(t.start)}–${esc(t.end)}</strong><span>${(gd.performers||[]).filter(p=>p.sessions?.[i]).length}人</span></div>`).join('')}</div>`;
}

function render(){
  header(); $('#clock').textContent=nowHHMM(); const c=$('#content');
  if(currentTab==='now')c.innerHTML=renderNow();
  else if(currentTab==='people')c.innerHTML=`<section class="section"><h2>出演者</h2>${renderPeople(false)}</section>`;
  else if(currentTab==='favorites')c.innerHTML=`<section class="section"><h2>お気に入り</h2>${renderPeople(true)}</section>`;
  else if(currentTab==='map')c.innerHTML=`<section class="section"><h2>会場マップ</h2>${renderMap()}</section>`;
  else c.innerHTML=`<section class="section"><h2>タイムテーブル</h2>${renderTimetable()}</section>`;
  bindContent();
}

function bindContent(){
  $$('.star').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();toggleFavorite(b.dataset.fav)});
  const s=$('#searchInput'); if(s)s.oninput=()=>{const pos=s.selectionStart;const val=s.value;const wrap=s.closest('.section');wrap.innerHTML=`<h2>${currentTab==='favorites'?'お気に入り':'出演者'}</h2>${renderPeople(currentTab==='favorites')}`;const n=$('#searchInput');n.focus();n.setSelectionRange(pos,pos);bindContent();};
  $$('[data-mapwhere]').forEach(b=>b.onclick=()=>gotoWhere(b.dataset.mapwhere));
  $$('[data-mapkey]').forEach(b=>b.onclick=()=>{selectedMapKey=b.dataset.mapkey;selectedMapArea=(DATA.maps[selectedMapKey].areas||[])[0]??null;mapEditMode=false;render()});
  $$('[data-maparea]').forEach(b=>b.onclick=()=>{selectedMapArea=b.dataset.maparea;mapEditMode=false;render()});
  $$('[data-tg]').forEach(b=>b.onclick=()=>{timetableGroup=b.dataset.tg;render()});
  const eb=$('#mapEditBtn'); if(eb)eb.onclick=()=>{mapEditMode=!mapEditMode;render()};
  const cb=$('#mapClearBtn'); if(cb)cb.onclick=async()=>{const m=DATA.maps[selectedMapKey];m.coords=m.coords||{};delete m.coords[String(selectedMapArea)];await persistCurrent();render()};
  const canvas=$('#mapCanvas'); if(canvas&&mapEditMode)canvas.onclick=async e=>{const r=canvas.getBoundingClientRect();const x=((e.clientX-r.left)/r.width*100),y=((e.clientY-r.top)/r.height*100);const m=DATA.maps[selectedMapKey];m.coords=m.coords||{};m.coords[String(selectedMapArea)]=[+x.toFixed(2),+y.toFixed(2)];await persistCurrent();mapEditMode=false;render()};
}

function gotoWhere(where){const found=findMapForWhere(DATA.maps,where);if(!found)return;selectedMapKey=found.key;selectedMapArea=found.area;mapEditMode=false;currentTab='map';render();}
async function persistCurrent(){if(isBuiltin())return;await putEvent(DATA);EVENTS=EVENTS.map(e=>e.id===DATA.id?DATA:e);}

function openWizard(){wizardStep=1;draft={id:uid(),event:{title:'',date:'',venue:''},rule:{shoot1:20,move1:5,shoot2:20,move2:5,cheki:20},parsed:null,reviewOnly:false};$('#wizard').classList.add('open');renderWizard();}
function closeWizard(){$('#wizard').classList.remove('open');draft=null;}
function captureMeta(){draft.event.title=$('#wTitle').value.trim();draft.event.date=$('#wDate').value;draft.event.venue=$('#wVenue').value.trim();for(const [k,id] of Object.entries({shoot1:'#r1',move1:'#r2',shoot2:'#r3',move2:'#r4',cheki:'#r5'}))draft.rule[k]=Math.max(0,Number($(id).value)||0);}
function applyImportedObject(obj){
  const src=obj?.draft||obj;
  if(!src||typeof src!=='object') throw new Error('JSONの内容が空です。');
  if(src.event&&typeof src.event==='object') draft.event={...draft.event,...src.event};
  if(src.rule&&typeof src.rule==='object') draft.rule={...draft.rule,...src.rule};
  const groups=src.groups||{};
  if(!groups||typeof groups!=='object'||!Object.keys(groups).length) throw new Error('groups が見つかりません。');
  draft.parsed={groups,maps:src.maps||{},timetableImages:src.timetableImages||{}};
}
async function loadJsonFile(file){if(!file)return;const text=await file.text();$('#jsonBox').value=text;try{applyImportedObject(JSON.parse(text));$('#jsonMsg').textContent='JSONを読み込みました。';}catch(e){$('#jsonMsg').textContent=`確認してください：${e.message||e}`;}}
function fieldNeedsReview(obj,key){return !obj||obj?.uncertainFields?.includes(key)||(obj?.confidence&&Number(obj.confidence[key])<.86);}
function reviewStats(){let total=0,warn=0;for(const g of Object.values(draft?.parsed?.groups||{})){for(const p of g.performers||[]){const nameBad=fieldNeedsReview(p,'name');(p.sessions||[]).forEach(s=>{if(!s)return;total++;if(nameBad||fieldNeedsReview(s,'a1')||fieldNeedsReview(s,'a2')||fieldNeedsReview(s,'cheki'))warn++;});}}return{total,warn};}
function confNote(obj,key){const v=obj?.confidence?.[key];return v==null?'':`<div class="confidence ${Number(v)<.86?'bad':''}">${Math.round(Number(v)*100)}%</div>`;}
function renderGroupTimes(groups){return Object.entries(groups).map(([g,gd])=>`<div class="group-time-card"><strong>${esc(groupLabel(g))}</strong>${(gd.times||[]).map((t,i)=>`<div class="group-time-row"><span>${esc(t.label||`${i+1}部`)}</span><input type="time" class="group-time" data-g="${esc(g)}" data-si="${i}" data-k="start" value="${esc(t.start)}"><input type="time" class="group-time" data-g="${esc(g)}" data-si="${i}" data-k="end" value="${esc(t.end)}"></div>`).join('')}</div>`).join('');}
function renderReviewRows(groups){const rows=[];for(const [g,gd] of Object.entries(groups)){(gd.performers||[]).forEach((p,pi)=>{const nameBad=fieldNeedsReview(p,'name');const max=Math.max((gd.times||[]).length,(p.sessions||[]).length);for(let si=0;si<max;si++){const s=p.sessions?.[si]??null,active=!!s,flag=active&&(nameBad||fieldNeedsReview(s,'a1')||fieldNeedsReview(s,'a2')||fieldNeedsReview(s,'cheki'));if(draft.reviewOnly&&!flag)continue;rows.push(`<tr class="${flag?'flagged':''}"><td>${esc(g)}</td><td><input class="review-input edit-name ${nameBad?'uncertain':''}" data-g="${esc(g)}" data-pi="${pi}" value="${esc(p.name)}">${confNote(p,'name')}</td><td><label class="toggle-row"><input type="checkbox" class="edit-active" data-g="${esc(g)}" data-pi="${pi}" data-si="${si}" ${active?'checked':''}>${esc(gd.times?.[si]?.label||`${si+1}部`)}</label></td><td><input class="review-input edit-session ${active&&fieldNeedsReview(s,'a1')?'uncertain':''}" data-g="${esc(g)}" data-pi="${pi}" data-si="${si}" data-k="a1" value="${esc(s?.a1||'')}" ${active?'':'disabled'}>${active?confNote(s,'a1'):''}</td><td><input class="review-input edit-session ${active&&fieldNeedsReview(s,'a2')?'uncertain':''}" data-g="${esc(g)}" data-pi="${pi}" data-si="${si}" data-k="a2" value="${esc(s?.a2||'')}" ${active?'':'disabled'}>${active?confNote(s,'a2'):''}</td><td><label class="toggle-row"><input type="checkbox" class="edit-cheki" data-g="${esc(g)}" data-pi="${pi}" data-si="${si}" ${active&&s?.cheki!==false?'checked':''} ${active?'':'disabled'}>あり</label>${active?confNote(s,'cheki'):''}</td></tr>`);}})}return rows.join('');}

function renderWizard(){
  $('#wizardSteps').innerHTML=[1,2,3].map(n=>`<span class="${n<=wizardStep?'on':''}"></span>`).join('');const body=$('#wizardBody');
  if(wizardStep===1) body.innerHTML=`<div class="warn"><strong>無料版では画像の自動解析を行いません。</strong><br>解析済みのイベントJSONを読み込むと、端末内に保存してNOW・お気に入り・地図を利用できます。</div><div class="form-group"><label>イベントJSONファイル</label><input id="jsonFile" type="file" accept="application/json,.json" class="field"></div><div class="form-group"><label>またはJSONを貼り付け</label><textarea id="jsonBox" class="field codebox" placeholder='{"event": {...}, "groups": {...}}'>${draft.parsed?esc(JSON.stringify({event:draft.event,rule:draft.rule,...draft.parsed},null,2)):''}</textarea></div><div id="jsonMsg" class="subtle"></div><div class="actions"><button class="primary" id="next1">読み込んで次へ</button></div>`;
  else if(wizardStep===2) body.innerHTML=`<div class="form-group"><label>イベント名</label><input id="wTitle" class="field" value="${esc(draft.event.title)}" placeholder="例：○○撮影会"></div><div class="grid2"><div class="form-group"><label>開催日</label><input id="wDate" type="date" class="field" value="${esc(draft.event.date)}"></div><div class="form-group"><label>会場</label><input id="wVenue" class="field" value="${esc(draft.event.venue)}" placeholder="任意"></div></div><div class="form-group"><label>1枠の時間構成（分）</label><div class="phase-grid"><label>撮影1<input id="r1" type="number" class="field" value="${draft.rule.shoot1}"></label><label>移動1<input id="r2" type="number" class="field" value="${draft.rule.move1}"></label><label>撮影2<input id="r3" type="number" class="field" value="${draft.rule.shoot2}"></label><label>移動2<input id="r4" type="number" class="field" value="${draft.rule.move2}"></label><label>チェキ<input id="r5" type="number" class="field" value="${draft.rule.cheki}"></label></div></div><div class="actions"><button class="secondary" id="back2">戻る</button><button class="primary" id="next2">確認へ</button></div>`;
  else {const groups=draft.parsed?.groups||{},st=reviewStats();body.innerHTML=`<div class="panel"><span class="pill">${esc(draft.event.date)}</span><h3>${esc(draft.event.title||'名称未設定')}</h3><div class="subtle">${esc(draft.event.venue||'会場未設定')}</div></div>${Object.keys(groups).length?`<div class="section compact"><h2>グループ・部の時間</h2>${renderGroupTimes(groups)}</div>`:''}<div class="review-tools"><div class="review-summary"><span class="pill">出演枠 ${st.total}</span><span class="pill warnpill">要確認 ${st.warn}</span></div><button id="reviewOnly" class="review-toggle ${draft.reviewOnly?'active':''}">${draft.reviewOnly?'すべて表示':'要確認のみ'}</button></div><div class="review-table"><table><thead><tr><th>GROUP</th><th>出演者</th><th>出演</th><th>第1エリア</th><th>第2エリア</th><th>チェキ</th></tr></thead><tbody>${renderReviewRows(groups)||'<tr><td colspan="6">データがありません</td></tr>'}</tbody></table></div><div class="warn" style="margin-top:10px">内容を確認してから保存してください。黄色は信頼度情報が付いているJSONで要確認になった項目です。</div><div class="actions"><button class="secondary" id="back3">戻る</button><button class="primary" id="saveEvent">端末に保存</button></div>`;}
  bindWizard();
}

function bindWizard(){
  const jf=$('#jsonFile'); if(jf)jf.onchange=()=>loadJsonFile(jf.files?.[0]);
  if($('#next1'))$('#next1').onclick=()=>{try{const text=$('#jsonBox').value.trim();if(text)applyImportedObject(JSON.parse(text));if(!draft.parsed)throw new Error('JSONを選択または貼り付けてください。');wizardStep=2;renderWizard()}catch(e){alert(`JSONを読み込めませんでした：${e.message||e}`)}};
  if($('#back2'))$('#back2').onclick=()=>{wizardStep=1;renderWizard()};
  if($('#next2'))$('#next2').onclick=()=>{captureMeta();if(!draft.event.title||!draft.event.date){alert('イベント名と開催日は必須です。');return;}draft.reviewOnly=false;wizardStep=3;renderWizard()};
  if($('#back3'))$('#back3').onclick=()=>{wizardStep=2;renderWizard()}; if($('#reviewOnly'))$('#reviewOnly').onclick=()=>{draft.reviewOnly=!draft.reviewOnly;renderWizard()}; if($('#saveEvent'))$('#saveEvent').onclick=saveDraftEvent;
  $$('.group-time').forEach(el=>el.onchange=()=>{draft.parsed.groups[el.dataset.g].times[+el.dataset.si][el.dataset.k]=el.value});
  $$('.edit-name').forEach(el=>el.onchange=()=>{const p=draft.parsed.groups[el.dataset.g].performers[+el.dataset.pi];p.name=el.value.trim();p.performerId=normalizeName(p.name);if(p.confidence)p.confidence.name=1;p.uncertainFields=(p.uncertainFields||[]).filter(x=>x!=='name');renderWizard()});
  $$('.edit-active').forEach(el=>el.onchange=()=>{const p=draft.parsed.groups[el.dataset.g].performers[+el.dataset.pi],si=+el.dataset.si;p.sessions=p.sessions||[];p.sessions[si]=el.checked?(p.sessions[si]||{a1:'',a2:'',cheki:true,confidence:{},uncertainFields:['a1','a2']}):null;renderWizard()});
  $$('.edit-session').forEach(el=>el.onchange=()=>{const s=draft.parsed.groups[el.dataset.g].performers[+el.dataset.pi].sessions[+el.dataset.si];if(!s)return;s[el.dataset.k]=el.value.trim();if(s.confidence)s.confidence[el.dataset.k]=1;s.uncertainFields=(s.uncertainFields||[]).filter(x=>x!==el.dataset.k);renderWizard()});
  $$('.edit-cheki').forEach(el=>el.onchange=()=>{const s=draft.parsed.groups[el.dataset.g].performers[+el.dataset.pi].sessions[+el.dataset.si];if(!s)return;s.cheki=el.checked;if(s.confidence)s.confidence.cheki=1;s.uncertainFields=(s.uncertainFields||[]).filter(x=>x!=='cheki');renderWizard()});
}

async function saveDraftEvent(){const p=draft.parsed||{};const evt=normalizeEvent({id:draft.id,event:draft.event,rule:draft.rule,groups:p.groups||{},maps:p.maps||{},timetableImages:p.timetableImages||{},createdAt:new Date().toISOString()});await putEvent(evt);EVENTS.push(evt);closeWizard();setEvent(evt.id);}

function openManager(){$('#manager').classList.add('open');renderManager();}
function closeManager(){$('#manager').classList.remove('open');}
function renderManager(){const x=eventMeta(DATA);$('#managerBody').innerHTML=`<div class="panel"><h3>${esc(x.title||'名称未設定')}</h3><div class="subtle">${esc(x.date||'')} ${esc(x.venue||'')}</div><div class="meta" style="margin-top:6px">${Object.keys(DATA.groups||{}).length}グループ・${allPerformers().length}出演者</div></div><div class="manager-actions"><button id="exportBtn2" class="secondary">JSONを書き出す</button><label class="secondary file-button">JSONを読み込む<input id="importFile" type="file" accept="application/json,.json" hidden></label>${!isBuiltin()?'<button id="deleteEvent" class="danger">このイベントを削除</button>':''}</div><div class="subtle">イベントとお気に入りはこの端末のブラウザ内に保存されます。端末変更時はJSONを書き出して移行してください。</div>`;$('#exportBtn2').onclick=exportCurrent;$('#importFile').onchange=importJson;const d=$('#deleteEvent');if(d)d.onclick=deleteCurrent;}
function exportCurrent(){const copy=JSON.parse(JSON.stringify(DATA));delete copy.builtin;const blob=new Blob([JSON.stringify(copy,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${eventMeta(DATA).date||'event'}-${eventMeta(DATA).title||'shooting'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function importJson(e){const file=e.target.files?.[0];if(!file)return;try{const obj=normalizeEvent(JSON.parse(await file.text()));obj.id=obj.id&&!EVENTS.some(x=>x.id===obj.id)?obj.id:uid();obj.builtin=false;await putEvent(obj);EVENTS.push(obj);closeManager();setEvent(obj.id);}catch(err){alert(`JSONを読み込めませんでした：${err.message||err}`)}}
async function deleteCurrent(){if(isBuiltin())return;if(!confirm('このイベントを端末から削除しますか？'))return;const id=DATA.id;await removeEvent(id);EVENTS=EVENTS.filter(e=>e.id!==id);closeManager();setEvent(BUILTIN.id);}

async function init(){
  BUILTIN=normalizeEvent(await fetch('event-default.json').then(r=>r.json()));BUILTIN.builtin=true;
  await migrateLegacy(); const custom=(await listEvents()).map(normalizeEvent).filter(e=>e?.id);
  EVENTS=[BUILTIN,...custom]; currentEventId=localStorage.getItem('shooting-current-event-v3')||localStorage.getItem('shooting-current-event')||BUILTIN.id;DATA=EVENTS.find(e=>e.id===currentEventId)||BUILTIN;currentEventId=DATA.id;
  $('#eventSelect').onchange=e=>setEvent(e.target.value);$('#addEvent').onclick=openWizard;$('#manageBtn').onclick=openManager;$('#closeWizard').onclick=closeWizard;$('#closeManager').onclick=closeManager;
  $('#timeInput').onchange=e=>{selectedTime=e.target.value;liveMode=false;render()};$('#nowBtn').onclick=()=>{selectedTime=nowHHMM();liveMode=true;render()};
  $$('.bottom button').forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;render()});
  render();const api=$('#apiState');if(api){api.textContent='無料版・JSON読込';api.className='api-state ok';}
  setInterval(()=>{$('#clock').textContent=nowHHMM();if(liveMode){const n=nowHHMM();if(n!==selectedTime){selectedTime=n;render();}}},15000);
}

init();
