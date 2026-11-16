/* Intranet ZZS JčK: aplikace nad daty z exportu (data/intranet.json) */
const D = __DATA__;
const BASE = 'http://intranet.zzsjck.local';
__ICON__
Object.assign(ICON, {
  lib:'<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm4 0v16M12 8h5M12 12h5"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  addr:'<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 17c.8-2 2.4-3 4.5-3s3.7 1 4.5 3"/>',
  chev:'<path d="m9 6 6 6-6 6"/>',
  steps:'<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>'
});
const svg = (n, extra='') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${ICON[n]||ICON.file}</svg>`;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const store = {
  get(k, d){ try{ const v = localStorage.getItem('zzs.'+k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('zzs.'+k, JSON.stringify(v)); }catch(e){} }
};
const A = h => `href="${esc(h)}" target="_blank" rel="noopener"`;
const enc = u => { try { return encodeURI(decodeURI(u)); } catch(e){ return u; } };
const fmtD = (ts, t=false) => ts ? new Date(ts).toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'}) + (t ? ' · ' + new Date(ts).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'}) : '') : '';
const parseCz = s => { const m = String(s||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/); return m ? new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0)).getTime() : 0; };
const fsize = b => b > 1048576 ? (b/1048576).toFixed(1).replace('.',',') + ' MB' : Math.max(1, Math.round(b/1024)) + ' kB';
const typeOf = (icon, name='') => {
  const n = (name||'').toLowerCase(), i = (icon||'').toLowerCase();
  if (i === 'folder') return 'folder';
  const ext = (n.match(/\.([a-z0-9]{2,5})$/)||[])[1] || '';
  if (/^icxls|xls/.test(i) || /^xls/.test(ext)) return 'xlsx';
  if (/^icdoc|doc/.test(i) || /^doc/.test(ext) || ext==='rtf') return 'docx';
  if (/pdf/.test(i) || ext==='pdf') return 'pdf';
  if (/^icppt|ppt/.test(i) || /^ppt/.test(ext)) return 'ppt';
  if (['jpg','jpeg','png','gif'].includes(ext)) return 'img';
  return ext ? ext.slice(0,4) : 'soubor';
};
const fi = t => t === 'folder' ? `<span class="fi folder">${svg('folder')}</span>` : `<span class="fi ${['xlsx','docx','pdf'].includes(t)?t:'oth'}">${esc(t.slice(0,4).toUpperCase())}</span>`;

/* ---------- normalizace dat ---------- */
const colIdx = (l, ...names) => { for (const n of names) { const i = l.cols.indexOf(n); if (i >= 0) return i; } return -1; };
function uiKind(l){
  if (l.kind === 'library') return 'library';
  if (l.cols.includes('Adresa URL')) return 'links';
  if (l.cols.includes('E-mailová adresa') || l.cols.includes('Příjmení')) return 'contacts';
  if (l.cols.includes('Nadpis') && l.cols.length <= 4) return 'news';
  return 'table';
}
const KIND = {library:'Knihovna dokumentů', links:'Odkazy', contacts:'Kontakty', news:'Seznam oznámení', table:'Seznam'};
const KICON = {library:'lib', links:'link', contacts:'addr', news:'bell', table:'list'};
const SITES = D.sites;
SITES.forEach(s => {
  s.lists = s.lists.filter(l => !/^Telefonní seznam/.test(l.title));
  s.lists.forEach((l, i) => {
    l.idx = i; l.site = s; l.ui = uiKind(l);
    const ti = colIdx(l, 'Nadpis', 'Název'), di = colIdx(l, 'Změněno');
    l.rows.forEach(r => {
      r.ts = di >= 0 ? parseCz(r.c[di]) : 0;
      if (l.ui === 'contacts') { const a = colIdx(l,'Příjmení'), b = colIdx(l,'Jméno'); r.t = ((r.c[a]||'') + ' ' + (r.c[b]||'')).trim(); }
      else if (l.ui === 'links') { const u = colIdx(l,'Adresa URL'); r.t = r.c[u] || r.h; }
      else if (ti >= 0) r.t = r.c[ti];
      else r.t = r.c.find(x => x && !/^\d+$/.test(x)) || '';
      if (l.ui === 'library') r.type = typeOf(r.i, r.t);
    });
  });
});
const siteBy = k => SITES.find(s => s.key === k);

/* všechna oznámení napříč weby */
const NEWS = [];
SITES.forEach(s => s.lists.filter(l => l.ui === 'news').forEach(l => {
  if (s.key === 'root' && l.title === 'Oznámení') {
    const byKey = new Map(l.rows.map(r => [r.t + '|' + new Date(r.ts).toISOString().slice(0,16), r]));
    D.newsMain.forEach(n => {
      const ts = new Date(n.date).getTime(), r = byKey.get(n.title + '|' + new Date(ts).toISOString().slice(0,16));
      NEWS.push({site:s, list:l, title:n.title, ts, attach:n.attach || !!(r && r.a), href:r ? r.h : '', files:r ? (r.f||[]) : [], body:r ? r.body : ''});
    });
  } else l.rows.forEach(r => NEWS.push({site:s, list:l, title:r.t, ts:r.ts, attach:r.a || !!(r.f && r.f.length), href:r.h, files:r.f||[], body:r.body||''}));
}));
NEWS.sort((a,b) => b.ts - a.ts);
NEWS.forEach((n,i) => n.id = i);

/* ---------- komponenty ---------- */
function newsRow(n, showSite=true){
  return `<article class="item"><div class="item-t"><div>
    <h3><a href="#" data-news="${n.id}" style="color:inherit;text-decoration:none">${esc(n.title)}</a></h3>
    <div class="meta"><span>${fmtD(n.ts, true)}</span>${showSite?`<span class="pill">${esc(n.site.title)}</span>`:''}
    ${n.attach?`<span class="pill">${svg('clip')}Příloha</span>`:''}</div></div></div></article>`;
}
function paged(host, rows, draw, step=50){
  let n = step;
  const go = () => { host.innerHTML = rows.slice(0, n).map(draw).join('') + (rows.length > n ? `<div style="padding:14px 0;text-align:center"><button class="btn sec" data-more>Zobrazit dalších ${Math.min(step, rows.length - n)} z ${rows.length - n}</button></div>` : '');
    host.querySelector('[data-more]')?.addEventListener('click', () => { n += step; go(); }); };
  go();
}
const emptyBox = (t, d='') => `<div class="empty"><b>${esc(t)}</b>${esc(d)}</div>`;
const cnt = l => l.rows.length >= 100 ? '100+' : l.rows.length;

/* ---------- oblasti (dlaždice úvodní stránky) ---------- */
const AREAS = [
 {k:'postupy', t:'Pracovní postupy', d:'Návody, postupy a metodické pokyny pro výjezdy', i:'steps',
  src:[['root','Návody'],['zzs-jh','Pracovní postupy'],['vycvikove-stredisko','First Responder']]},
 {k:'vzdelavani', t:'Vzdělávání', d:'Kurzy, školení, konference a studijní materiály', i:'cap',
  src:[['vycvikove-stredisko','Vzdělávací akce'],['vycvikove-stredisko','Oznámení'],['zzs-jh','Vzdělávání'],['krizove-rizeni','Vzdělávací materiál pro MU'],['krizove-rizeni','Cvičení IZS'],['vycvikove-stredisko','Knihovna'],['vycvikove-stredisko','Výzkumná šetření - studenti']]},
 {k:'provoz', t:'Provoz', d:'Provozní informace, základny, služby a rozpisy', i:'pulse',
  src:[['zzs-jh','Provozní záležitosti'],['zzs-jh','Zápisy ze schůží'],['zzs-jh','Provoz JH'],['zzs-jh','Provoz Dačice'],['zzs-jh','Provoz Třeboň'],['zzs-jh','Autoprovoz'],['root','INFORMACE ZZUM'],['root','Rozpis služeb'],['root','Uzavřená oddělení']],
  ext:[{t:'Dopravní uzavírky',d:'Dopravní info dnes',h:'http://www.dopravniinfodnes.cz/typ-dopravni-uzavirky-a-omezeni/'}]},
 {k:'krizove', t:'Krizové řízení', d:'Havarijní připravenost, cvičení IZS a krizové plány', i:'alert',
  src:[['krizove-rizeni','Dokumenty traumatologické havarijní a krizové připravenosti ZZS JčK'],['krizove-rizeni','Cvičení IZS'],['krizove-rizeni','Kontakty OKR']]},
 {k:'predpisy', t:'Předpisy a dokumenty', d:'Vnitřní předpisy, GDPR a sdělení vedení', i:'book',
  src:[['predpisy','Vnitřní předpisy ZZS JčK'],['predpisy','Oznámení'],['predpisy','Připomínkové řízení'],['root','GDPR'],['root','Ochrana oznamovatele'],['root','Sdělení ředitele ZZS JčK'],['root','Sdělení náměstka léčebné péče ZZS JčK']]},
 {k:'lide', t:'Lidé a kontakty', d:'Telefonní seznamy, osoby a kontakty na střediska', i:'users',
  src:[['vycvikove-stredisko','Kontakty VVS']], go:[{t:'Telefonní seznamy',d:'188 kontaktů ze 7 základen',h:'#telefony',i:'phone'},{t:'Osoby a skupiny',d:'Adresář uživatelů intranetu',h:'#lide',i:'users'}]},
 {k:'zamestnanci', t:'Zaměstnanci a benefity', d:'Mzdy, benefity, odbory a psychosociální podpora', i:'heart',
  src:[['root','Sdílené dokumenty'],['odbory','Oznámení'],['odbory','Sdílené dokumenty'],['odbory','Odkazy'],['krizove-rizeni','SPIS']]}
];
AREAS.forEach(a => { a.lists = a.src.map(([sk, lt]) => { const s = siteBy(sk); return s && s.lists.find(l => l.title === lt); }).filter(Boolean);
  a.ts = Math.max(0, ...a.lists.flatMap(l => l.rows.map(r => r.ts || 0))); });
const areaBy = k => AREAS.find(a => a.k === k);

/* ---------- pohledy ---------- */
function vHome(){
  const logo = document.querySelector('.brand img').src;
  return `<div class="hub"><img class="hub-logo" src="${logo}" alt=""><h1>Intranet ZZS JčK</h1>
  <div class="hub-tiles">${AREAS.map(a=>`<a class="hub-tile" href="#oblast-${a.k}"><span class="ico">${svg(a.i)}</span><h2>${esc(a.t)}</h2><p>${esc(a.d)}</p></a>`).join('')}</div></div>`;
}
function bindHome(){}

function vArea(a){
  const news = NEWS.filter(n => a.lists.includes(n.list)).slice(0, 8);
  const card = (href, icon, title, sub, ext) => `<a ${ext?A(href):`href="${href}"`}><span class="fi" style="background:var(--brand-soft);color:var(--brand)">${svg(icon)}</span><span>${esc(title)}<br><small style="color:var(--muted);font-weight:400">${esc(sub)}</small></span></a>`;
  return `<div class="hero"><div><div class="crumb"><a href="#domu">Domů</a> / ${esc(a.t)}</div><h1>${esc(a.t)}</h1><p>${esc(a.d)}</p></div></div>
  <div class="grid g-home"><div class="col"><section class="card"><div class="card-h"><h2>Obsah</h2></div><div class="card-b"><div class="lib">
    ${(a.go||[]).map(g=>card(g.h,g.i,g.t,g.d)).join('')}
    ${a.lists.map(l=>card(`#seznam-${l.site.key}-${l.idx}`, KICON[l.ui], l.title, `${l.site.title} · ${cnt(l)} položek`)).join('')}
    ${(a.ext||[]).map(e=>card(e.h,'road',e.t,e.d,1)).join('')}</div></div></section></div>
  <div class="col"><section class="card"><div class="card-h"><h2>Poslední změny</h2></div><div class="card-b news">${news.length?news.map(n=>newsRow(n,false)).join(''):emptyBox('Zatím žádná oznámení')}</div></section></div></div>`;
}
function evItem(e){
  const d = new Date(e.start);
  return `<div class="ev"><div class="date"><b>${d.getDate()}</b><span>${d.toLocaleDateString('cs-CZ',{month:'short'})}</span></div><div><h3>${esc(e.title)}</h3>
    <p>${e.end&&e.end.slice(0,10)!==e.start.slice(0,10)?`${fmtD(new Date(e.start).getTime())} – ${fmtD(new Date(e.end).getTime())}`:fmtD(new Date(e.start).getTime())}</p>${e.text?`<p>${esc(e.text)}</p>`:''}</div></div>`;
}

let nf = {site:'all', q:''};
function vNews(){
  const used = SITES.filter(s => NEWS.some(n => n.site === s));
  return `<div class="hero"><div><h1>Oznámení</h1><p>${NEWS.length} oznámení ze všech webů, nejnovější nahoře.</p></div></div>
  <div class="bar"><input class="field" id="nq" type="search" placeholder="Hledat v oznámeních" aria-label="Hledat v oznámeních" style="flex:1;max-width:380px" value="${esc(nf.q)}">
    <div class="chips" role="group" aria-label="Web"><button class="chip" data-s="all" aria-pressed="${nf.site==='all'}">Vše</button>${used.map(s=>`<button class="chip" data-s="${s.key}" aria-pressed="${nf.site===s.key}">${esc(s.title)}</button>`).join('')}</div></div>
  <section class="card"><div class="card-b news" id="nl"></div></section>`;
}
function bindNews(){
  const draw = () => { const q = norm(nf.q);
    const r = NEWS.filter(n => (nf.site==='all' || n.site.key===nf.site) && norm(n.title+' '+n.site.title).includes(q));
    const h = $('#nl'); if(!r.length){ h.innerHTML = emptyBox('Nic nenalezeno','Zkuste jiný výraz nebo web.'); return; } paged(h, r, n=>newsRow(n)); };
  $('#nq').addEventListener('input', e => { nf.q = e.target.value; draw(); });
  document.querySelectorAll('.chip[data-s]').forEach(b => b.addEventListener('click', () => { nf.site = b.dataset.s; document.querySelectorAll('.chip[data-s]').forEach(x=>x.setAttribute('aria-pressed', x===b)); draw(); }));
  draw();
}

function vWeb(s){
  const news = NEWS.filter(n => n.site === s).slice(0,6), orig = s.url + '/default.aspx';
  return `<div class="hero"><div><div class="crumb"><a href="#weby">Weby</a> / ${esc(s.title)}</div><h1>${esc(s.title)}</h1><p>${s.lists.length} seznamů a knihoven</p></div><a class="btn sec" ${A(orig)}>Původní web</a></div>
  <div class="grid g-home"><div class="col"><section class="card"><div class="card-h"><h2>Seznamy a knihovny</h2></div><div class="card-b">
    <div class="lib">${s.lists.map(l=>`<a href="#seznam-${s.key}-${l.idx}"><span class="fi" style="background:var(--brand-soft);color:var(--brand)">${svg(KICON[l.ui])}</span><span>${esc(l.title)}<br><small style="color:var(--muted);font-weight:400">${KIND[l.ui]} · ${cnt(l)} položek</small></span></a>`).join('')||emptyBox('Web nemá žádné seznamy')}</div></div></section></div>
  <div class="col"><section class="card"><div class="card-h"><h2>Nejnovější oznámení</h2></div><div class="card-b news">${news.length?news.map(n=>newsRow(n,false)).join(''):emptyBox('Žádná oznámení')}</div></section></div></div>`;
}
function vWebs(){
  return `<div class="hero"><div><h1>Weby</h1><p>Hlavní intranet a podweby organizace.</p></div></div>
  <div class="tiles">${SITES.map(s=>`<a class="tile" href="#web-${s.key}"><span class="ico">${svg('globe')}</span><b>${esc(s.title)}</b><small>${s.lists.length} seznamů a knihoven</small></a>`).join('')}</div>`;
}

let lf = {};
function vList(s, l){
  const f = lf[s.key+l.idx] || (lf[s.key+l.idx] = {q:'', path:''});
  const head = `<div class="hero"><div><div class="crumb"><a href="#weby">Weby</a> / <a href="#web-${s.key}">${esc(s.title)}</a> / ${esc(l.title)}</div><h1>${esc(l.title)}</h1><p>${KIND[l.ui]} · ${cnt(l)} položek${l.rows.length>=100?' (zobrazeno prvních 100)':''}</p></div><a class="btn sec" ${A(l.legacy+'/AllItems.aspx')}>Otevřít originál</a></div>`;
  if (!l.rows.length && !(l.files||[]).length) return head + `<section class="card"><div class="card-b">${emptyBox('Seznam je prázdný','V exportu nebyly žádné položky.')}</div></section>`;
  return head + `<div class="bar"><input class="field" id="lq" type="search" placeholder="Hledat v seznamu" aria-label="Hledat v seznamu" style="flex:1;max-width:380px" value="${esc(f.q)}"></div>
    <section class="card"><div class="card-b tw" id="lb"></div></section>`;
}
function bindList(s, l){
  const f = lf[s.key+l.idx], host = $('#lb'); if(!host) return;
  const draw = () => {
    const q = norm(f.q);
    if (l.ui === 'news') { const rows = l.rows.map(r=>({id:NEWS.findIndex(n=>n.list===l && n.title===r.t && n.ts===r.ts)})).filter(x=>x.id>=0).map(x=>NEWS[x.id]).filter(n=>norm(n.title).includes(q)); host.className='card-b news'; paged(host, rows, n=>newsRow(n,false)); if(!rows.length) host.innerHTML=emptyBox('Nic nenalezeno'); return; }
    if (l.ui === 'library') {
      const rows = l.rows.filter(r => norm(r.t+' '+r.c.join(' ')).includes(q));
      const files = (l.files||[]).filter(x => norm(x.p).includes(q));
      host.innerHTML = `<table><thead><tr><th>Název</th><th>Změněno</th><th>Změnil</th></tr></thead><tbody>${rows.map(r=>`<tr><td><div class="nm">${fi(r.type)}<a ${A(r.h)}>${esc(r.t)}</a></div></td><td>${esc(r.c[2]||'')}</td><td>${esc(r.c[3]||'')}</td></tr>`).join('')}
        ${files.map(x=>`<tr><td><div class="nm">${fi(typeOf('',x.p))}<a ${A(enc(x.u))}>${esc(x.p)}</a></div></td><td colspan="2">${fsize(x.s)}</td></tr>`).join('')}</tbody></table>`;
      if(!rows.length && !files.length) host.innerHTML = emptyBox('Nic nenalezeno'); return; }
    if (l.ui === 'links') {
      const rows = l.rows.filter(r => norm(r.t+' '+r.h+' '+r.c.join(' ')).includes(q));
      host.innerHTML = `<div class="lib" style="margin:6px 0">${rows.map(r=>`<a ${A(r.h)}><span class="fi" style="background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)">${svg('link')}</span><span>${esc(r.t)}<br><small style="color:var(--muted);font-weight:400;word-break:break-all">${esc(r.h)}</small></span></a>`).join('')}</div>`; if(!rows.length) host.innerHTML=emptyBox('Nic nenalezeno'); return; }
    // tabulka (kontakty, katalog, ostatní)
    const skip = new Set(['Přílohy','Upravit','Typ']); const keep = l.cols.map((c,i)=>i).filter(i => !skip.has(l.cols[i]) && l.rows.some(r => r.c[i]));
    const rows = l.rows.filter(r => norm(r.c.join(' ')).includes(q));
    host.innerHTML = `<table><thead><tr>${keep.map(i=>`<th>${esc(l.cols[i])}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,300).map(r=>`<tr>${keep.map(i=>{ const v = r.c[i]||''; return `<td>${/@/.test(v)?`<a href="mailto:${esc(v)}">${esc(v)}</a>`:/^[+\d][\d ]{7,}$/.test(v)?`<a href="tel:${esc(v.replace(/\s/g,''))}">${esc(v)}</a>`:esc(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>${rows.length>300?`<p class="meta" style="padding:10px">Zobrazeno prvních 300 z ${rows.length}. Zúžte hledání.</p>`:''}`;
    if(!rows.length) host.innerHTML = emptyBox('Nic nenalezeno');
  };
  $('#lq')?.addEventListener('input', e => { f.q = e.target.value; draw(); }); draw();
}

/* Dokumenty: všechny knihovny */
function vDocs(){
  const libs = SITES.flatMap(s => s.lists.filter(l => l.ui === 'library'));
  return `<div class="hero"><div><h1>Dokumenty</h1><p>${libs.length} knihoven dokumentů ve všech webech.</p></div></div>
  ${SITES.map(s=>{ const ls = s.lists.filter(l=>l.ui==='library'); return ls.length?`<h2 style="font-size:1.05rem;margin:22px 0 12px">${esc(s.title)}</h2><div class="lib">${ls.map(l=>`<a href="#seznam-${s.key}-${l.idx}"><span class="fi" style="background:var(--brand-soft);color:var(--brand)">${svg('lib')}</span><span>${esc(l.title)}<br><small style="color:var(--muted);font-weight:400">${cnt(l)} položek</small></span></a>`).join('')}</div>`:''; }).join('')}`;
}

/* Telefonní seznamy */
const PH_NAMES = {CB:'České Budějovice',JH:'Jindřichův Hradec',PI:'Písek',PT:'Prachatice',ST:'Strakonice',TA:'Tábor','ČK':'Český Krumlov'};
let ph = {tab:'all', q:''};
function vPhones(){
  const tabs = ['all', ...Object.keys(D.phones)];
  return `<div class="hero"><div><h1>Telefonní seznamy</h1><p>Kontakty podle základen. ${Object.values(D.phones).reduce((a,b)=>a+b.length,0)} záznamů.</p></div></div>
  <div class="bar"><input class="field" id="pq" type="search" placeholder="Hledat jméno, pracoviště nebo číslo" aria-label="Hledat v kontaktech" style="flex:1;max-width:380px" value="${esc(ph.q)}">
    <div class="chips" role="group" aria-label="Základna">${tabs.map(k=>`<button class="chip" data-k="${k}" aria-pressed="${ph.tab===k}" title="${esc(PH_NAMES[k]||'Všechny')}">${k==='all'?'Vše':k}</button>`).join('')}</div></div>
  <section class="card"><div class="card-b tw" id="pb"></div></section>`;
}
function bindPhones(){
  const draw = () => {
    const q = norm(ph.q).replace(/\s/g,'');
    const rows = Object.entries(D.phones).filter(([k])=>ph.tab==='all'||ph.tab===k).flatMap(([k,r])=>r.map(x=>({...x,k})))
      .filter(x => norm([x.prijmeni,x.jmeno,x.misto,x.klapka,x.cislo,x.mobil].join('')).replace(/\s/g,'').includes(q));
    const h = $('#pb'); if(!rows.length){ h.innerHTML = emptyBox('Nic nenalezeno'); return; }
    const tel = v => v ? `<a href="tel:${esc(v.replace(/\s/g,''))}">${esc(v)}</a>` : '';
    h.innerHTML = `<table><thead><tr><th>Příjmení</th><th>Jméno</th><th>Pracoviště</th><th>Klapka</th><th>Telefon</th><th>Mobil</th>${ph.tab==='all'?'<th>Základna</th>':''}</tr></thead><tbody></tbody></table>`;
    const tb = h.querySelector('tbody'); let n = 100;
    const go = () => { tb.innerHTML = rows.slice(0,n).map(x=>`<tr><td>${esc(x.prijmeni)}</td><td>${esc(x.jmeno)}</td><td>${esc(x.misto)}</td><td>${esc(x.klapka)}</td><td>${tel(x.cislo)}</td><td>${tel(x.mobil)}</td>${ph.tab==='all'?`<td>${x.k}</td>`:''}</tr>`).join('');
      h.querySelector('.more-r')?.remove(); if(rows.length>n){ h.insertAdjacentHTML('beforeend',`<div class="more-r" style="padding:14px;text-align:center"><button class="btn sec">Zobrazit dalších ${Math.min(100,rows.length-n)}</button></div>`); h.querySelector('.more-r button').onclick=()=>{ n+=100; go(); }; } };
    go();
  };
  $('#pq').addEventListener('input', e => { ph.q = e.target.value; draw(); });
  document.querySelectorAll('.chip[data-k]').forEach(b => b.addEventListener('click', () => { ph.tab = b.dataset.k; document.querySelectorAll('.chip[data-k]').forEach(x=>x.setAttribute('aria-pressed', x===b)); draw(); }));
  draw();
}

/* Osoby a skupiny */
let pq = '';
function vPeople(){
  const people = D.people.filter(p => p.jmeno && !/\\/.test(p.jmeno));
  return `<div class="hero"><div><h1>Osoby a skupiny</h1><p>${people.length} uživatelů intranetu.</p></div></div>
  <div class="bar"><input class="field" id="oq" type="search" placeholder="Hledat jméno nebo e-mail" aria-label="Hledat osobu" style="flex:1;max-width:380px" value="${esc(pq)}"></div>
  <section class="card"><div class="card-b tw" id="ob"></div></section>`;
}
function bindPeople(){
  const people = D.people.filter(p => p.jmeno && !/\\/.test(p.jmeno)).sort((a,b)=>a.jmeno.localeCompare(b.jmeno,'cs'));
  const draw = () => { const q = norm(pq); const r = people.filter(p => norm(p.jmeno+' '+p.email).includes(q)); const h = $('#ob');
    if(!r.length){ h.innerHTML = emptyBox('Nic nenalezeno'); return; }
    paged(h, r, p => `<div class="item" style="display:flex;justify-content:space-between;gap:12px;padding:10px 0"><span>${esc(p.jmeno)}${p.spravce?' <span class="pill">Správce</span>':''}</span>${p.email?`<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`:''}</div>`, 100); };
  $('#oq').addEventListener('input', e => { pq = e.target.value; draw(); }); draw();
}

/* Kalendář */
function vCal(){
  const ev = (D.events||[]).slice().sort((a,b)=>b.start.localeCompare(a.start));
  return `<div class="hero"><div><h1>Kalendář</h1><p>Události hlavního webu.</p></div><a class="btn sec" ${A(BASE+'/Lists/Kalend/calendar.aspx')}>Původní kalendář</a></div>
  <section class="card"><div class="card-b">${ev.length?ev.map(evItem).join(''):emptyBox('Žádné události')}</div></section>`;
}

/* ---------- detail oznámení ---------- */
function showNews(id){
  const n = NEWS[id]; if(!n) return;
  const bg = $('#mBg');
  $('#mT').textContent = n.title;
  $('#mB').innerHTML = `<div class="meta" style="margin-bottom:12px"><span>${fmtD(n.ts,true)}</span><span class="pill">${esc(n.site.title)}</span><span class="pill">${esc(n.list.title)}</span></div>
    ${n.body?`<div style="white-space:pre-wrap;margin-bottom:14px">${esc(n.body)}</div>`:''}
    ${n.files.length?`<h3 style="font-size:.95rem;margin:6px 0 8px">Přílohy</h3><div class="lib" style="grid-template-columns:1fr">${n.files.map(f=>`<a ${A(enc(f.u))}>${fi(typeOf('',f.n))}<span>${esc(f.n)}<br><small style="color:var(--muted);font-weight:400">${fsize(f.s)}</small></span></a>`).join('')}</div>`:(n.attach?`<p class="meta">Příloha je dostupná v původním oznámení.</p>`:'')}
    ${n.href?`<p style="margin:16px 0 0"><a class="btn sec" ${A(n.href)}>Otevřít původní oznámení</a></p>`:''}`;
  bg.classList.add('on'); $('#mX').focus();
}
$('#mX').onclick = () => $('#mBg').classList.remove('on');
$('#mBg').addEventListener('click', e => { if(e.target.id==='mBg') $('#mBg').classList.remove('on'); });
document.addEventListener('click', e => { const a = e.target.closest('[data-news]'); if(a){ e.preventDefault(); showNews(+a.dataset.news); } });

/* ---------- navigace a router ---------- */
const NAV = [['domu','Domů','home'],...AREAS.map(a=>['oblast-'+a.k,a.t,a.i]),['--','Přehledy'],['oznameni','Oznámení','bell'],['dokumenty','Všechny dokumenty','file'],['kalendar','Kalendář','cal'],['telefony','Telefonní seznamy','phone'],['--','Archiv webů'],
  ...SITES.map(s=>['web-'+s.key, s.title, s.key==='root'?'home':s.key==='krizove-rizeni'?'alert':s.key==='odbory'?'users':s.key==='vycvikove-stredisko'?'cap':s.key==='predpisy'?'book':'globe'])];
function renderNav(cur){
  $('#nav').innerHTML = NAV.map(n => n[0]==='--' ? `<div class="nav-h">${n[1]}</div>` : `<a href="#${n[0]}" ${cur===n[0]?'aria-current="page"':''}>${svg(n[2])}${esc(n[1])}</a>`).join('');
}
function route(){
  const k = (location.hash||'#domu').slice(1); let html, bind, cur = 'domu', title = 'Domů';
  let m;
  if (k==='domu'||k==='') { html = vHome(); bind = bindHome; }
  else if ((m = k.match(/^oblast-(.+)$/)) && areaBy(m[1])) { const a = areaBy(m[1]); html = vArea(a); cur = k; title = a.t; }
  else if (k==='oznameni') { html = vNews(); bind = bindNews; cur = k; title = 'Oznámení'; }
  else if (k==='dokumenty') { html = vDocs(); cur = k; title = 'Dokumenty'; }
  else if (k==='kalendar') { html = vCal(); cur = k; title = 'Kalendář'; }
  else if (k==='telefony') { html = vPhones(); bind = bindPhones; cur = k; title = 'Telefonní seznamy'; }
  else if (k==='lide') { html = vPeople(); bind = bindPeople; cur = k; title = 'Osoby a skupiny'; }
  else if (k==='weby') { html = vWebs(); cur = 'web-root'; title = 'Weby'; }
  else if ((m = k.match(/^web-(.+)$/)) && siteBy(m[1])) { const s = siteBy(m[1]); html = vWeb(s); cur = k; title = s.title; }
  else if ((m = k.match(/^seznam-(.+)-(\d+)$/)) && siteBy(m[1]) && siteBy(m[1]).lists[+m[2]]) { const s = siteBy(m[1]), l = s.lists[+m[2]]; html = vList(s,l); bind = () => bindList(s,l); cur = 'web-'+s.key; title = l.title+' · '+s.title; }
  else { html = vHome(); bind = bindHome; }
  document.body.classList.toggle('is-home', html.startsWith('<div class="hub">'));
  renderNav(cur); $('#view').innerHTML = html; bind && bind();
  document.title = (title==='Domů'?'':title+' · ')+'Intranet ZZS JčK'; closeMenu(); window.scrollTo(0,0);
}
window.addEventListener('hashchange', route);

function closeMenu(){ $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); $('#burger').setAttribute('aria-expanded','false'); }
$('#burger').onclick = () => { const o = $('#side').classList.toggle('open'); $('#scrim').classList.toggle('on',o); $('#burger').setAttribute('aria-expanded',o); };
$('#scrim').onclick = closeMenu;
const root = document.documentElement;
const th = store.get('theme',null); if(th) root.dataset.theme = th;
$('#theme').onclick = () => { const dark = root.dataset.theme ? root.dataset.theme==='dark' : matchMedia('(prefers-color-scheme:dark)').matches; root.dataset.theme = dark?'light':'dark'; store.set('theme', root.dataset.theme); };
const setA = on => { if(on) root.dataset.a11y='on'; else delete root.dataset.a11y; $('#a11y').setAttribute('aria-pressed', on); store.set('a11y',on); };
setA(store.get('a11y',false)); $('#a11y').onclick = () => setA(root.dataset.a11y!=='on');

/* ---------- hledání (Ctrl+K) ---------- */
let IDX = null;
function buildIndex(){
  const idx = [];
  NAV.filter(n=>n[0]!=='--').forEach(n=>idx.push({g:'Stránky',t:n[1],h:'#'+n[0],i:n[2]}));
  idx.push({g:'Stránky',t:'Osoby a skupiny',h:'#lide',i:'users'});
  SITES.forEach(s => s.lists.forEach(l => idx.push({g:'Seznamy a knihovny',t:l.title,s:s.title,h:`#seznam-${s.key}-${l.idx}`,i:KICON[l.ui]})));
  NEWS.forEach(n => idx.push({g:'Oznámení',t:n.title,s:fmtD(n.ts),news:n.id,i:'bell'}));
  SITES.forEach(s => s.lists.filter(l=>l.ui==='library'||l.ui==='links').forEach(l => l.rows.forEach(r => idx.push({g:l.ui==='links'?'Odkazy':'Dokumenty',t:r.t,s:l.title,h:r.h,e:1,i:l.ui==='links'?'link':'file'}))));
  Object.entries(D.phones).forEach(([k,rows]) => rows.forEach(r => idx.push({g:'Kontakty',t:(r.prijmeni+' '+r.jmeno).trim(),x:[r.misto,r.klapka,r.cislo,r.mobil].join(' '),s:k+(r.klapka?' · kl. '+r.klapka:''),h:'#telefony',i:'person'})));
  return idx;
}
let sel = 0;
function drawPal(){
  IDX = IDX || buildIndex();
  const q = norm($('#palIn').value.trim());
  const r = (q ? IDX.filter(x=>q.split(/\s+/).every(w=>norm(x.t+' '+(x.x||'')).includes(w))) : IDX.filter(x=>x.g==='Stránky')).slice(0,40);
  let g='', h='';
  r.forEach((x,i)=>{ if(x.g!==g){ g=x.g; h+=`<li class="grp">${g}</li>`; }
    h += `<li><a href="${x.news!=null?'#':esc(x.h)}" ${x.e?'target="_blank" rel="noopener"':''} ${x.news!=null?`data-news="${x.news}"`:''}>${svg(x.i||'file','style="width:18px;height:18px;stroke:var(--brand);fill:none;stroke-width:1.9;flex:none"')}<span>${esc(x.t)}</span>${x.s?`<small>${esc(x.s)}</small>`:''}</a></li>`; });
  $('#palList').innerHTML = h || '<li><div class="empty"><b>Nic nenalezeno</b>Zkuste kratší výraz.</div></li>'; sel = 0; mark();
}
const items = () => [...document.querySelectorAll('#palList a')];
function mark(){ items().forEach((a,i)=>a.classList.toggle('sel',i===sel)); items()[sel]?.scrollIntoView({block:'nearest'}); }
const openPal = () => { $('#palBg').classList.add('on'); $('#palIn').value=''; drawPal(); $('#palIn').focus(); };
const closePal = () => $('#palBg').classList.remove('on');
$('#openSearch').onclick = openPal;
$('#palBg').addEventListener('click', e => { if(e.target.id==='palBg') closePal(); });
$('#palList').addEventListener('click', e => { if(e.target.closest('a')) closePal(); });
$('#palIn').addEventListener('input', drawPal);
$('#palIn').addEventListener('keydown', e => {
  if(e.key==='ArrowDown'){ e.preventDefault(); sel=Math.min(sel+1,items().length-1); mark(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); sel=Math.max(sel-1,0); mark(); }
  else if(e.key==='Enter'){ e.preventDefault(); items()[sel]?.click(); }
});
document.addEventListener('keydown', e => {
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openPal(); }
  else if(e.key==='Escape'){ closePal(); $('#mBg').classList.remove('on'); }
  else if(e.key==='/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)){ e.preventDefault(); openPal(); }
});
route();
