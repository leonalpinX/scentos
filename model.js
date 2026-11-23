// ScentOS Beta 1.0: pure domain transformations and validation; no DOM/IndexedDB here.
export const VERSION = '0.1.2-delivery-and-test';
export const STORES = ['catalog','profiles','collections','approvals','tests','wearLogs','settings'];
export const APPROVAL_STATES = { pending: null, approved: true, rejected: false };
export const COLLECTION_STATES = ['vorhanden','bestellt','wunschliste'];
export const DEFAULT_PROFILE_ID = 'profile-demo';
export const today = () => { const d = new Date(); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };

export function normalized(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
}
export function fingerprint(fragrance) {
  return [fragrance.brand, fragrance.name, fragrance.concentration].map(normalized).join('|');
}
export function associationKey(profileId, fragranceId) {
  return `${profileId}::${fragranceId}`;
}
export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
export function approvalLabel(profile) {
  return profile?.approver?.mode === 'named' && profile.approver.name?.trim()
    ? `Approved by ${profile.approver.name.trim()}` : null;
}
export function validateFragrance(f, catalog=[], editingId=null) {
  const brand = String(f.brand ?? '').trim(), name = String(f.name ?? '').trim();
  if (!brand || !name) throw new Error('Marke und Duftname sind Pflichtfelder (vorläufige K03-Regel).');
  const fp = fingerprint({...f,brand,name});
  if (catalog.some(x=>x.id!==editingId && fingerprint(x)===fp)) {
    throw new Error('Ein Duft mit derselben Marke, demselben Namen und derselben Konzentration ist bereits vorhanden.');
  }
  return {...f,brand,name,concentration:String(f.concentration??'').trim(),
    notes: Array.isArray(f.notes) ? f.notes.map(x=>String(x).trim()).filter(Boolean) : [],
    tags: Array.isArray(f.tags) ? f.tags.map(x=>String(x).trim()).filter(Boolean) : [],
    source:String(f.source??'').trim(),fingerprint:fp};
}
export function validateProfile(profile) {
  const name = String(profile?.name??'').trim();
  if (!name) throw new Error('Ein Profil benötigt einen Namen.');
  const mode = profile?.approver?.mode;
  if (mode !== 'named' && mode !== 'none') throw new Error('Bitte Approver-Modus wählen.');
  const approverName = String(profile.approver.name??'').trim();
  if (mode === 'named' && !approverName) throw new Error('Bitte den Namen der freigebenden Person angeben.');
  const traits = Array.isArray(profile.traits)?profile.traits.map(x=>String(x).trim()).filter(Boolean):[];
  if (traits.length>5) throw new Error('Pro Profil sind höchstens fünf persönliche Eigenschaften erlaubt.');
  return {...profile,name,traits,approver:{mode,name:mode==='named'?approverName:''}};
}
export function migrateLegacy(legacy) {
  if (!legacy || !Array.isArray(legacy.duftstammdaten) || !Array.isArray(legacy.sammlung)) {
    throw new Error('Keine gültige ScentOS-Masterdata-v0.2-Datei.');
  }
  const catalog = legacy.duftstammdaten.map(item=>{
    const {id,marke,name,kollektion,konzentration,duftnoten,duftprofil_tags,vorlaeufige_anlaesse,vorlaeufige_jahreszeiten,datenquelle,hinweis,probe_suche} = item;
    if(!id) throw new Error('Duft ohne stabile ID in der Quelldatei.');
    return validateFragrance({
      id,brand:marke,name,collection:kollektion??'',concentration:konzentration??'',
      notes:duftnoten??[],tags:duftprofil_tags??[],occasions:vorlaeufige_anlaesse??[],
      seasons:vorlaeufige_jahreszeiten??[],source:datenquelle??'',
      note:hinweis??'',sampleNote:probe_suche??''
    }, []);
  });
  // Reject a contradictory catalog before writing. The source's names are editorial data, not a dedupe rule change.
  if(new Set(catalog.map(x=>x.id)).size!==catalog.length) throw new Error('Doppelte Duft-IDs in der Quelle.');
  if(new Set(catalog.map(x=>x.fingerprint)).size!==catalog.length) throw new Error('Doppelte Düfte in der Quelle.');
  const profile = validateProfile(legacy.seedProfil ?? {id:DEFAULT_PROFILE_ID,name:'Mein Profil',traits:[],approver:{mode:'none',name:''}});
  const collections=[],approvals=[];
  for(const item of legacy.sammlung){
    if(!catalog.some(c=>c.id===item.duft_id)) throw new Error(`Sammlung enthält unbekannten Duft: ${item.duft_id}`);
    const key=associationKey(profile.id,item.duft_id);
    const status=item.status;
    if(!COLLECTION_STATES.includes(status)) throw new Error('Unbekannter Sammlungsstatus in Quelle.');
    collections.push({key,profileId:profile.id,fragranceId:item.duft_id,status,
      amountMl:item.menge_ml??null,note:item.hinweis??''});
    const approved=item.approved_by_katrin;
    if(approved!==null && approved!==true && approved!==false && approved!==undefined) throw new Error('Ungültiger Freigabestatus in Quelle.');
    approvals.push({key,profileId:profile.id,fragranceId:item.duft_id,
      approved:approved??null,note:item.katrin_kommentar??''});
  }
  const tests=(legacy.dufttests??[]).map(item=>{
    if(!item.id||!catalog.some(c=>c.id===item.duft_id))throw new Error('Ungültiger Dufttest in Quelldatei.');
    return {id:item.id,profileId:profile.id,fragranceId:item.duft_id,date:item.datum,
      firstImpression:item.firstImpression??null,sillage:item.sillage??null,
      longevityHours:item.longevityHours??null,overall:item.overall??null,
      note:item.note??''};
  });
  if(new Set(tests.map(x=>x.id)).size!==tests.length)throw new Error('Doppelte Dufttest-IDs in Quelle.');
  return {catalog,profiles:[profile],collections,approvals,tests,wearLogs:[],
    settings:[{key:'legacyAppSettings',value:legacy.app_einstellungen??{}},
      {key:'seedVersion',value:String(legacy.version??'legacy')}],
    format:'scentos-local-v1'};
}
export function validateBackup(data) {
  if(!data||data.format!=='scentos-local-v1') throw new Error('Keine gültige ScentOS-Datensicherung.');
  for(const store of STORES){if(!Array.isArray(data[store])) throw new Error(`Bereich ${store} fehlt in der Sicherung.`);}
  const catalogIds=new Set();const fps=new Set();
  for(const f of data.catalog){if(!f.id||catalogIds.has(f.id))throw new Error('Doppelte/fehlende Duft-ID.');catalogIds.add(f.id);const fp=fingerprint(f);if(fps.has(fp))throw new Error('Doppelter Duft.');fps.add(fp);validateFragrance(f,[]);}
  const profileIds=new Set();for(const p of data.profiles){if(!p.id||profileIds.has(p.id))throw new Error('Doppelte/fehlende Profil-ID.');profileIds.add(p.id);validateProfile(p);}
  for(const store of ['collections','approvals','tests','wearLogs']){
    for(const x of data[store]){if(!profileIds.has(x.profileId)||!catalogIds.has(x.fragranceId))throw new Error(`Ungültiger Profil-/Duftbezug in ${store}.`);if(!(x.key||x.id))throw new Error(`Fehlender Datensatzschlüssel in ${store}.`);}
  }
  for(const x of data.approvals){if(![null,true,false].includes(x.approved))throw new Error('Ungültiger Approval-Zustand.');}
  return data;
}


// Decide an additive import before opening a write transaction. In particular,
// do not create personal records for catalog entries skipped as duplicates.
export function planAdditiveImport(incoming, current) {
  const keyFields={catalog:'id',profiles:'id',collections:'key',approvals:'key',tests:'id',wearLogs:'id',settings:'key'};
  const known=Object.fromEntries(STORES.map(s=>[s,new Set(current[s].map(x=>String(x[keyFields[s]])))]));
  const fingerprints=new Set(current.catalog.map(fingerprint));
  const plan={insert:{},added:{},skipped:{}};
  for(const store of STORES){
    plan.insert[store]=[]; plan.skipped[store]=0;
    for(const row of incoming[store]){
      const id=String(row[keyFields[store]]??'');
      const duplicate=store==='catalog' && fingerprints.has(fingerprint(row));
      if(!id || known[store].has(id) || duplicate){plan.skipped[store]++;continue;}
      plan.insert[store].push(row);
      known[store].add(id);
      if(store==='catalog')fingerprints.add(fingerprint(row));
    }
    plan.added[store]=plan.insert[store].length;
  }
  for(const store of ['collections','approvals','tests','wearLogs']){
    for(const row of plan.insert[store]){
      if(!known.profiles.has(String(row.profileId))||!known.catalog.has(String(row.fragranceId))){
        throw new Error(`Import abgebrochen: ${store} verweist auf einen nicht übernommenen Duft oder ein fehlendes Profil. Keine Daten verändert.`);
      }
      if((store==='collections'||store==='approvals')&&row.key!==associationKey(row.profileId,row.fragranceId)){
        throw new Error(`Import abgebrochen: Ungültiger zusammengesetzter Schlüssel in ${store}. Keine Daten verändert.`);
      }
    }
  }
  return plan;
}
