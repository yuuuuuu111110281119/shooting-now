export function mins(hm='00:00') {
  const [h,m] = String(hm).split(':').map(Number);
  return (Number.isFinite(h)?h:0)*60 + (Number.isFinite(m)?m:0);
}

export function hm(total=0) {
  const m = ((Number(total)||0)%1440+1440)%1440;
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

export function normalizeName(value='') {
  return String(value).trim().toLowerCase().replace(/\s+/g,'');
}

export function legacyPhases(rule={}) {
  const n = (v, d) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : d);
  return [
    {kind:'shoot', label:'撮影', minutes:n(rule.shoot1,20), location:'a1'},
    {kind:'move', label:'移動', minutes:n(rule.move1,5), from:'a1', to:'a2'},
    {kind:'shoot', label:'撮影', minutes:n(rule.shoot2,20), location:'a2'},
    {kind:'move', label:'移動', minutes:n(rule.move2,5), from:'a2', to:'cheki'},
    {kind:'cheki', label:'チェキ', minutes:n(rule.cheki,20), location:'cheki'},
  ];
}

export function rulePhases(rule={}) {
  if (Array.isArray(rule.phases) && rule.phases.length) {
    return rule.phases.map((p,i)=>({
      kind:String(p?.kind||'shoot'),
      label:String(p?.label||p?.kind||`工程${i+1}`),
      minutes:Math.max(0, Number(p?.minutes)||0),
      location:p?.location,
      from:p?.from,
      to:p?.to,
    }));
  }
  return legacyPhases(rule);
}

export function sessionLocation(session, key) {
  if (!session) return '';
  if (key === 'cheki') return session.cheki === false ? '' : (session.chekiArea || 'チェキエリア');
  return String(session[key] ?? '');
}

export function stateFor(performer, groupData, rule, time) {
  const t = mins(time);
  const times = groupData?.times || [];
  const phases = rulePhases(rule);
  const totalRule = phases.reduce((s,p)=>s+p.minutes,0);
  const sessions = performer?.sessions || [];

  for (let i=0;i<sessions.length;i++) {
    const session = sessions[i];
    const slot = times[i];
    if (!session || !slot?.start) continue;
    const start = mins(slot.start);
    const end = slot.end ? mins(slot.end) : start + totalRule;
    if (t < start || t >= end) continue;

    let cursor = start;
    for (let pi=0; pi<phases.length; pi++) {
      const phase = phases[pi];
      const phaseEnd = cursor + phase.minutes;
      if (t < phaseEnd || (phase.minutes===0 && t===cursor)) {
        if (phase.kind === 'shoot') {
          const where = sessionLocation(session, phase.location || (pi===0?'a1':'a2')) || '撮影エリア未設定';
          const next = nextVisiblePhase(phases, pi+1, session, start);
          return {kind:'shoot',label:phase.label||'撮影中',where,remain:Math.max(0,phaseEnd-t),sessionIndex:i,sessionLabel:slot.label||`${i+1}部`,next};
        }
        if (phase.kind === 'move') {
          const from = sessionLocation(session, phase.from || 'a1');
          let to = phase.to === 'cheki' ? sessionLocation(session,'cheki') : sessionLocation(session, phase.to || 'a2');
          if (phase.to === 'cheki' && session.cheki === false) to = '終了';
          const where = [from,to].filter(Boolean).join(' → ') || '移動中';
          const next = nextVisiblePhase(phases, pi+1, session, start);
          return {kind:'move',label:phase.label||'移動中',where,remain:Math.max(0,phaseEnd-t),sessionIndex:i,sessionLabel:slot.label||`${i+1}部`,next};
        }
        if (phase.kind === 'cheki') {
          if (session.cheki === false) return {kind:'done',label:'出演終了',where:'—',remain:null,sessionIndex:i,sessionLabel:slot.label||`${i+1}部`,next:null};
          return {kind:'cheki',label:phase.label||'チェキ',where:sessionLocation(session,'cheki')||'チェキエリア',remain:Math.max(0,phaseEnd-t),sessionIndex:i,sessionLabel:slot.label||`${i+1}部`,next:null};
        }
        return {kind:phase.kind,label:phase.label||phase.kind,where:sessionLocation(session,phase.location)||phase.label,remain:Math.max(0,phaseEnd-t),sessionIndex:i,sessionLabel:slot.label||`${i+1}部`,next:null};
      }
      cursor = phaseEnd;
    }
    return {kind:'done',label:'出演終了',where:'—',remain:null,sessionIndex:i,sessionLabel:slot.label||`${i+1}部`,next:null};
  }

  let upcoming = null;
  for (let i=0;i<sessions.length;i++) {
    if (!sessions[i] || !times[i]?.start) continue;
    const st = mins(times[i].start);
    if (st >= t && (!upcoming || st < upcoming.st)) upcoming = {st,i};
  }
  if (upcoming) {
    const s = sessions[upcoming.i];
    return {
      kind:'next', label:'待機', where:'—', remain:upcoming.st-t,
      sessionIndex:upcoming.i, sessionLabel:times[upcoming.i].label||`${upcoming.i+1}部`,
      next:`${times[upcoming.i].start}〜 ${s.a1||'撮影エリア'}`
    };
  }
  return {kind:'done',label:'出演終了',where:'—',remain:null,sessionIndex:null,sessionLabel:null,next:null};
}

function nextVisiblePhase(phases, fromIndex, session, start) {
  let cursor = start;
  for (let i=0;i<fromIndex;i++) cursor += phases[i]?.minutes||0;
  for (let i=fromIndex;i<phases.length;i++) {
    const p = phases[i];
    if (p.kind === 'cheki' && session.cheki === false) { cursor += p.minutes; continue; }
    if (p.kind === 'move') { cursor += p.minutes; continue; }
    let where = '';
    if (p.kind === 'shoot') where = sessionLocation(session,p.location||'a2');
    else if (p.kind === 'cheki') where = sessionLocation(session,'cheki') || 'チェキ';
    else where = sessionLocation(session,p.location) || p.label;
    return `${hm(cursor)}〜 ${where}`;
  }
  return null;
}

export function eventDayISO(date=new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function areaCandidates(where='') {
  const text = String(where).trim();
  const out = [text];
  const n = text.match(/(\d+)/)?.[1];
  if (n) out.push(n, Number(n));
  return out;
}

export function findMapForWhere(maps={}, where='') {
  const text = String(where).trim();
  if (!text) return null;
  const candidates = areaCandidates(text).map(String);
  let best = null;
  for (const [key,map] of Object.entries(maps||{})) {
    const label = String(map?.label||'');
    for (const area of map?.areas||[]) {
      const a = String(area);
      let score = 0;
      if (a === text) score = 100;
      else if (candidates.includes(a)) score = 60;
      else if (text.endsWith(a)) score = 40;
      if (label && text.startsWith(label)) score += 30;
      if (!best || score > best.score) best = {key,map,area,score};
    }
  }
  return best && best.score>0 ? best : null;
}

export function durationMinutes(rule={}) {
  return rulePhases(rule).reduce((s,p)=>s+p.minutes,0);
}
