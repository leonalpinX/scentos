import {dbOpen,getAll,get,put,remove,readState,seedIfEmpty,safeImport} from './db.js';
import {approvalLabel,associationKey,validateFragrance,validateProfile,newId,COLLECTION_STATES,DEFAULT_PROFILE_ID,today,VERSION} from './model.js';
const $=s=>document.querySelector(s);
const view=$('#view'), messages=$('#messages'), profileSelector=$('#active-profile');
let activeProfileId=DEFAULT_PROFILE_ID,tab='catalog',editCatalogId=null,editTestId=null,cache=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words=s=>String(s??'').split(',').map(x=>x.trim()).filter(Boolean);
const opt=(value,text,selected=false)=>`<option value="${esc(value)}" ${selected?'selected':''}>${esc(text)}</option>`;
const nf=value=>(value==null?'':String(value));
const current=()=>cache.profiles.find(p=>p.id===activeProfileId);
const catalogs=()=>[...cache.catalog].sort((a,b)=>a.brand.localeCompare(b.brand,'de')||a.name.localeCompare(b.name,'de'));
const collectionFor=id=>cache.collections.find(x=>x.key===associationKey(activeProfileId,id));
const approvalFor=id=>cache.approvals.find(x=>x.key===associationKey(activeProfileId,id));
function announce(message,error=false){messages.innerHTML=`<div class="toast ${error?'error':''}">${esc(message)}</div>`;}
function field(title,name,value='',options={}){
  const {type='text',wide=false,required=false,placeholder='',min='',max=''}=options;
  return `<label class="field ${wide?'wide':''}"><span>${esc(title)}</span><input type="${type}" name="${esc(name)}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required?'required':''} ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''}></label>`;
}
function dropdown(name,values,selected){return `<select name="${name}">${values.map(x=>opt(x[0],x[1],String(x[0])===String(selected))).join('')}</select>`;}
function panel(title,subtitle,content){return `<section class="panel"><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p>${content}</section>`;}
async function refresh(){const names=['catalog','profiles','collections','approvals','tests','wearLogs','settings'];cache=Object.fromEntries(await Promise.all(names.map(async n=>[n,await getAll(n)])));if(!cache.profiles.find(x=>x.id===activeProfileId))activeProfileId=cache.profiles[0]?.id||null;profileSelector.innerHTML=cache.profiles.map(x=>opt(x.id,x.name,x.id===activeProfileId)).join('');view.innerHTML=render();}
function render(){switch(tab){case 'catalog':return catalogView();case 'collection':return collectionView();case 'profile':return profileView();case 'tests':return testsView();case 'backup':return backupView();}}
function catalogView(){
 const f=cache.catalog.find(x=>x.id===editCatalogId)||{};
 const form=`<form id="catalog-form" class="stack"><div class="form-grid">
 ${field('Marke *','brand',f.brand??'',{required:true})}${field('Duftname *','name',f.name??'',{required:true})}
 ${field('Konzentration / Version','concentration',f.concentration??'',{placeholder:'z. B. Eau de Parfum'})}${field('Kollektion','collection',f.collection??'')}
 ${field('Duftnoten (kommagetrennt)','notes',f.notes?.join(', ')??'',{wide:true})}${field('Tags (kommagetrennt)','tags',f.tags?.join(', ')??'',{wide:true})}
 ${field('Datenquelle / URL','source',f.source??'',{wide:true})}
 </div><div class="controls"><button class="primary action" type="submit">${editCatalogId?'Änderungen speichern':'Parfum zum Katalog hinzufügen'}</button>${editCatalogId?'<button class="secondary action" type="button" data-action="cancel-catalog">Abbrechen</button>':''}</div></form>`;
 const cards=catalogs().map(x=>`<article class="card" data-scent="${esc(x.id)}"><span class="brandname">${esc(x.brand)}</span><h3>${esc(x.name)}</h3><div><span class="pill">${esc(x.concentration||'Ohne Konzentrationsangabe')}</span></div><p class="muted">${esc(x.notes?.slice(0,4).join(' · ')||'Noch keine Duftnoten')}</p><div class="controls"><button class="secondary action" data-action="edit-catalog" data-id="${esc(x.id)}">Bearbeiten</button></div></article>`).join('');
 return panel('Zentraler Duftkatalog',`${cache.catalog.length} Düfte, gemeinsam für alle Profile auf diesem Gerät.`,
 `<div class="notice">K03 ist noch nicht fachlich abgenommen: Zurzeit sind Marke und Duftname Pflicht; gleiche Marke + Name + Konzentration gelten als Dublette.</div><div class="row"><h3>Parfum ${editCatalogId?'bearbeiten':'manuell ergänzen'}</h3><span class="subtle">Persönliche Bewertungen gehören nicht hierher.</span></div>${form}<hr style="border:0;border-top:1px solid #ebe9e1;margin:26px 0"><label class="field"><span>Im Katalog suchen</span><input id="catalog-search" class="search" placeholder="Marke, Duft oder Note" type="search"></label><div id="catalog-results" class="card-grid">${cards}</div>`);
}
function collectionView(){const profile=current();if(!profile)return panel('Meine Sammlung','',`<div class="empty">Lege zuerst ein Profil an.</div>`);
 const mine=cache.collections.filter(x=>x.profileId===profile.id);const label=approvalLabel(profile);
 const rows=catalogs().map(f=>{
  const own=collectionFor(f.id),approval=approvalFor(f.id);
  const approvalEditor=label?`<form class="approval-form" data-id="${esc(f.id)}"><p class="subtle">${esc(label)} · bisherige lokale Freigabe, keine verifizierte gegenseitige Bestätigung</p><div class="row"><label class="field"><span>Freigabe</span>${dropdown('approved',[['pending','Noch nicht getestet'],['approved','Freigegeben'],['rejected','Abgelehnt']],approval?.approved===true?'approved':approval?.approved===false?'rejected':'pending')}</label><label class="field"><span>Kommentar</span><input name="note" value="${esc(approval?.note||'')}" placeholder="Optional"></label><button class="secondary action" type="submit">Freigabe speichern</button></div></form>`:'<p class="notice">Kotaro Lives Alone: Approval deaktiviert. Empfehlungen dürfen dadurch nicht blockiert werden.</p>';
  return `<article class="item"><div class="row"><div><strong>${esc(f.brand)} · ${esc(f.name)}</strong><div class="subtle">${esc(f.concentration||'')}</div></div><span class="pill secondary-pill">${esc(own?.status||'Nicht in Sammlung')}</span></div><form class="collection-form" data-id="${esc(f.id)}"><div class="row"><label class="field"><span>Mein Status</span>${dropdown('status',[['none','Nicht in Sammlung'],...COLLECTION_STATES.map(x=>[x,x])],own?.status??'none')}</label><label class="field"><span>Menge (ml, optional)</span><input name="amountMl" type="number" step="0.1" min="0" value="${esc(nf(own?.amountMl))}"></label><button type="submit" class="secondary action">Sammlung speichern</button></div></form>${approvalEditor}</article>`;
 }).join('');
 return panel('Meine Sammlung',`${profile.name}: ${mine.length} Einträge. Nur dieses Profil wird geändert.`,rows?`<div class="item-list">${rows}</div>`:'<div class="empty">Keine Düfte im Katalog.</div>');
}
function profileView(){const p=current();
 const editor=p?`<form id="profile-form" class="stack"><div class="form-grid">${field('Profilname','name',p.name,{required:true})}
 <label class="field"><span>Approver-Konfiguration</span>${dropdown('approverMode',[['named','Name frei wählen'],['none','Kotaro Lives Alone']],p.approver.mode)}</label>
 <div class="approver-name-field" ${p.approver.mode==='none'?'hidden':''}>${field('Approver-Name','approverName',p.approver.name)}</div>
 ${field('Persönliche Eigenschaften, maximal fünf (kommagetrennt)','traits',p.traits.join(', '),{wide:true,placeholder:'Noch keine Eigenschaften erfasst'})}</div><button class="primary action" type="submit">Profil speichern</button></form>`:'';
 const solo=p?.approver?.mode==='none';
 return panel('Profile & Approver','Jedes Profil verwaltet seine eigene Sammlung und Freigabekonfiguration.',
 `${p?`<div class="notice">Aktives Profil: <strong>${esc(p.name)}</strong>. ${solo?'Approval ist deaktiviert (Kotaro Lives Alone).':`Dynamisches Label: <strong>${esc(approvalLabel(p))}</strong>.`}</div>`:''}<h3>Aktives Profil bearbeiten</h3>${editor}<hr style="border:0;border-top:1px solid #ebe9e1;margin:24px 0"><h3>Neues Profil anlegen</h3><form id="new-profile-form" class="stack"><div class="form-grid">${field('Profilname *','name','',{required:true})}<label class="field"><span>Approver</span>${dropdown('approverMode',[['named','Name frei wählen'],['none','Kotaro Lives Alone']],'named')}</label><div class="approver-name-field">${field('Name der freigebenden Person','approverName','')}</div></div><button class="secondary action" type="submit">Neues Profil erstellen</button></form><p class="subtle">Der Approver ist individuell pro Profil einstellbar. Persönliche Freigaben werden nur in diesem Browser gespeichert. Der 5-%-Einfluss persönlicher Eigenschaften auf Empfehlungen wird in einer späteren Phase umgesetzt.</p>`);
}
function testsView(){const p=current();if(!p)return panel('Dufttests','',`<div class="empty">Zuerst ein Profil auswählen.</div>`);
 const rows=cache.tests.filter(x=>x.profileId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
 const edit=rows.find(x=>x.id===editTestId)||{};
 const form=`<form id="test-form" class="stack"><div class="form-grid"><label class="field"><span>Duft</span><select name="fragranceId" required>${catalogs().map(x=>opt(x.id,`${x.brand} · ${x.name} (${x.concentration||'ohne Konzentration'})`,x.id===edit.fragranceId)).join('')}</select></label>${field('Testdatum','date',edit.date??today(),{type:'date',required:true})}${field('Erster Eindruck (1–5)','firstImpression',nf(edit.firstImpression),{type:'number',min:1,max:5})}${field('Sillage (1–5)','sillage',nf(edit.sillage),{type:'number',min:1,max:5})}${field('Haltbarkeit (Stunden)','longevityHours',nf(edit.longevityHours),{type:'number',min:0,max:240})}${field('Gesamtbewertung (1–5)','overall',nf(edit.overall),{type:'number',min:1,max:5})}${field('Bemerkungen','note',edit.note??'',{wide:true})}</div><div class="controls"><button type="submit" class="primary action">${editTestId?'Dufttest aktualisieren':'Dufttest speichern'}</button>${editTestId?'<button class="secondary action" type="button" data-action="cancel-test">Abbrechen</button>':''}</div></form>`;
 const list=rows.map(x=>{const scent=cache.catalog.find(c=>c.id===x.fragranceId);return `<article class="item"><div class="row"><strong>${esc(scent?.name||x.fragranceId)}</strong><span class="subtle">${esc(x.date)}</span></div><p class="muted">Erster Eindruck: ${esc(x.firstImpression??'–')} / 5 · Sillage: ${esc(x.sillage??'–')} / 5 · Haltbarkeit: ${esc(x.longevityHours??'–')} h · Gesamt: ${esc(x.overall??'–')} / 5</p><p>${esc(x.note||'')}</p><button class="secondary action" type="button" data-action="edit-test" data-id="${esc(x.id)}">Test fortsetzen / bearbeiten</button></article>`;}).join('');
 return panel('Persönliche Dufttests',`${rows.length} erfasste Tests für ${p.name}. Noch keine Empfehlungsberechnung.`,`<div class="notice">Nur ein Duft pro Tag wird empfohlen. Unvollständige Tests können später ergänzt werden; fehlende Bewertungen bleiben bewusst leer. Die Skalen entsprechen vorläufig den vorhandenen v0.2-Feldlisten (K07 offen).</div>${form}<h3 style="margin-top:30px">Bisherige Tests</h3>${list?`<div class="item-list">${list}</div>`:'<div class="empty">Noch keine Dufttests vorhanden.</div>'}`);
}
function backupView(){return panel('Lokale Datensicherung','JSON-Export und additive Importfunktion. Bestehende Einträge werden beim Import nicht überschrieben.',
 `<div class="notice warning"><strong>Wichtig:</strong> Lokale Browserdaten können bei Löschung des Website-Speichers verloren gehen. Der Export sichert die Daten in einer JSON-Datei. Keine Cloud-Synchronisierung.</div><div class="stack"><button id="export-data" class="primary action" type="button">Alle Profile und den Katalog als JSON exportieren</button><form id="import-form" class="stack"><label class="field"><span>ScentOS-Sicherung oder ursprüngliche v0.2-Masterdata-Datei importieren</span><input name="file" type="file" accept=".json,application/json" required></label><button class="secondary action" type="submit">Fehlende Einträge importieren</button></form></div><p class="subtle">Import ist absichtlich nur ergänzend: gleiche Schlüssel oder bereits bekannte Düfte werden übersprungen. Eine vollständige Wiederherstellung mit Überschreiben vorhandener Daten gehört nicht zu diesem Entwicklungsstand.</p>`);}

const inputVal=(form,name)=>form.elements.namedItem(name)?.value??'';
function getSubmittedProfile(form,existing={}){return validateProfile({
 id:existing.id??newId('profile'),name:inputVal(form,'name'),traits:form.id==='new-profile-form'?[]:words(inputVal(form,'traits')),
 approver:{mode:inputVal(form,'approverMode'),name:inputVal(form,'approverName')}
});}
async function handleSubmit(form){
 if(form.id==='catalog-form'){
  const all=await getAll('catalog');const old=editCatalogId?all.find(x=>x.id===editCatalogId):null;
  const proposal={...(old||{}),id:old?.id||newId('scent'),brand:inputVal(form,'brand'),name:inputVal(form,'name'),concentration:inputVal(form,'concentration'),collection:inputVal(form,'collection'),notes:words(inputVal(form,'notes')),tags:words(inputVal(form,'tags')),source:inputVal(form,'source'),occasions:old?.occasions||[],seasons:old?.seasons||[]};
  await put('catalog',validateFragrance(proposal,all,old?.id));editCatalogId=null;await refresh();announce('Katalogeintrag lokal gespeichert.');return;
 }
 if(form.id==='profile-form'){
  await put('profiles',getSubmittedProfile(form,current()));await refresh();announce('Profil und Approver lokal gespeichert.');return;
 }
 if(form.id==='new-profile-form'){
  const p=getSubmittedProfile(form);await put('profiles',p);activeProfileId=p.id;await refresh();announce('Neues getrenntes Profil angelegt.');return;
 }
 if(form.classList.contains('collection-form')){
  const id=form.dataset.id,key=associationKey(activeProfileId,id),status=inputVal(form,'status');
  if(status==='none'){await remove('collections',key);}else{
    if(!COLLECTION_STATES.includes(status))throw new Error('Ungültiger Sammlungsstatus.');
    const raw=inputVal(form,'amountMl');const amount=raw===''?null:Number(raw);
    if(amount!==null&&(!Number.isFinite(amount)||amount<0))throw new Error('Ungültige Menge.');
    const old=await get('collections',key);await put('collections',{...old,key,profileId:activeProfileId,fragranceId:id,status,amountMl:amount,note:old?.note||''});
  }
  await refresh();announce('Sammlungsstatus nur für das aktive Profil gespeichert.');return;
 }
 if(form.classList.contains('approval-form')){
  const p=current();if(p?.approver?.mode==='none')throw new Error('Dieses Profil benötigt keine Freigabe.');
  const key=associationKey(activeProfileId,form.dataset.id),v=inputVal(form,'approved');
  if(!['pending','approved','rejected'].includes(v))throw new Error('Ungültiger Approval-Zustand.');
  const approved=v==='pending'?null:v==='approved';
  await put('approvals',{key,profileId:activeProfileId,fragranceId:form.dataset.id,approved,note:inputVal(form,'note')});
  await refresh();announce('Freigabe lokal erfasst.');return;
 }
 if(form.id==='test-form'){
  const fragranceId=inputVal(form,'fragranceId');if(!cache.catalog.some(x=>x.id===fragranceId))throw new Error('Unbekannter Duft.');
  const n=name=>{const x=inputVal(form,name);return x===''?null:Number(x);};
  const ranges=[['firstImpression',1,5],['sillage',1,5],['overall',1,5],['longevityHours',0,240]];
  for(const [name,min,max] of ranges){const v=n(name);if(v!==null&&(!Number.isFinite(v)||v<min||v>max))throw new Error(`Ungültiger Wert bei ${name}.`);}
  const existing=editTestId?await get('tests',editTestId):null;
  if(editTestId&&(!existing||existing.profileId!==activeProfileId))throw new Error('Dieser Dufttest gehört nicht zum aktiven Profil.');
  await put('tests',{id:existing?.id??newId('test'),profileId:activeProfileId,fragranceId,date:inputVal(form,'date'),firstImpression:n('firstImpression'),sillage:n('sillage'),longevityHours:n('longevityHours'),overall:n('overall'),note:inputVal(form,'note')});
  editTestId=null;await refresh();announce('Dufttest profilspezifisch gespeichert.');return;
 }
 if(form.id==='import-form'){
  const file=form.elements.namedItem('file')?.files?.[0];if(!file)throw new Error('JSON-Datei auswählen.');
  if(file.size>5_000_000)throw new Error('Die Importdatei darf maximal 5 MB groß sein.');
  const data=JSON.parse(await file.text());const results=await safeImport(data);await refresh();
  announce(`Import abgeschlossen: ${Object.values(results.added).reduce((a,b)=>a+b,0)} Einträge ergänzt; ${Object.values(results.skipped).reduce((a,b)=>a+b,0)} vorhandene übersprungen.`);return;
 }
}
view.addEventListener('submit',async e=>{e.preventDefault();try{await handleSubmit(e.target);}catch(err){announce(err.message||String(err),true);}});
view.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action],#export-data');if(!btn)return;
 if(btn.id==='export-data'){
  try{const state=await readState();const blob=new Blob([JSON.stringify({...state,appVersion:VERSION},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`scentos-backup-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);announce('JSON-Datensicherung erstellt.');}catch(err){announce(err.message,true);}return;
 }
 if(btn.dataset.action==='edit-catalog'){editCatalogId=btn.dataset.id;await refresh();$('#catalog-form')?.scrollIntoView({behavior:'smooth'});}
 if(btn.dataset.action==='cancel-catalog'){editCatalogId=null;await refresh();}
 if(btn.dataset.action==='edit-test'){editTestId=btn.dataset.id;await refresh();$('#test-form')?.scrollIntoView({behavior:'smooth'});}
 if(btn.dataset.action==='cancel-test'){editTestId=null;await refresh();}
});
view.addEventListener('input',e=>{
 if(e.target.id==='catalog-search'){
  const q=e.target.value.toLocaleLowerCase('de-DE');
  for(const card of view.querySelectorAll('[data-scent]')){
   const x=cache.catalog.find(f=>f.id===card.dataset.scent);
   card.hidden=!`${x.brand} ${x.name} ${x.notes?.join(' ')} ${x.tags?.join(' ')}`.toLocaleLowerCase('de-DE').includes(q);
  }
 }
});
view.addEventListener('change',e=>{
 if(e.target.name==='approverMode'){
  const wrap=e.target.closest('form');const input=wrap.querySelector('.approver-name-field');
  if(input){input.hidden=e.target.value==='none';const name=input.querySelector('input');name.required=e.target.value==='named';}
 }
});
profileSelector.addEventListener('change',async e=>{activeProfileId=e.target.value;editTestId=null;await refresh();messages.innerHTML='';});
$('.tabs').addEventListener('click',async e=>{const button=e.target.closest('button[data-tab]');if(!button)return;tab=button.dataset.tab;editCatalogId=null;editTestId=null;for(const b of $('.tabs').querySelectorAll('button'))b.classList.toggle('active',b===button);await refresh();messages.innerHTML='';});
async function main(){
 try{
  await dbOpen();const response=await fetch('./scentos_public_catalog.json');if(!response.ok)throw new Error('Masterdata-Datei nicht geladen.');
  await seedIfEmpty(await response.json());await refresh();
  if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
 }catch(err){announce(`Start fehlgeschlagen: ${err.message}. Starte die Anwendung über http://localhost oder HTTPS.`,true);view.innerHTML='<div class="panel"><h2>Speicher nicht verfügbar</h2><p>Für diese PWA wird IndexedDB benötigt. Browser-Einstellungen für Website-Daten prüfen.</p></div>';}
}
main();
