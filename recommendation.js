// ScentOS: erklärbare, vorläufige Heuristik für Beta 1.0.
// Die vorläufigen v0.2-Gewichte 35/25/15/15/10 werden proportional
// auf 95 % skaliert, damit die vereinbarten maximal 5 % Profildaten hinzukommen.
// Keine KI und keine objektive Qualitäts-/Wirkungsbehauptung.
export const BASE_WEIGHTS = Object.freeze({ occasion:35, weather:25, time:15, rating:15, season:10 });
export const PROFILE_WEIGHT = 5;
export const OCCASION_OPTIONS = Object.freeze([
  ['kein_anlass','Kein besonderer Anlass'],['business','Business'],['homeoffice','Homeoffice'],
  ['freizeit','Freizeit'],['dinner','Dinner'],['date','Date'],['konzert','Konzert'],
  ['feier','Feier / Party'],['urlaub','Urlaub'],['sport','Sport'],['sonstiges','Anderer Anlass (Freitext)']
]);
const alias = Object.freeze({
  business:['business'],homeoffice:['homeoffice','business','alltag'],freizeit:['freizeit','alltag'],
  dinner:['dinner','abend','date'],date:['date','abend'],konzert:['konzert','abend','freizeit'],
  feier:['feier','abend','freizeit'],urlaub:['urlaub','freizeit'],sport:['sport','freizeit','alltag']
});
const clamp = x=>Math.max(0,Math.min(1,x));
const norm = s=>String(s??'').trim().normalize('NFKC').toLocaleLowerCase('de-DE');
const finite = v => typeof v==='number' && Number.isFinite(v);
const unique = xs => [...new Set(xs)];
const fallback = (label,details)=>({value:0.5,label,details});

export function seasonForDate(date=new Date(),latitude=50.87){
  const d=date instanceof Date?date:new Date(date);
  if(!Number.isFinite(d.getTime()))throw new Error('Ungültiger Empfehlungszeitpunkt.');
  const month=d.getMonth()+1;
  const north=month===12||month<=2?'winter':month<=5?'fruehling':month<=8?'sommer':'herbst';
  if(latitude>=0)return north;
  return {winter:'sommer',fruehling:'herbst',sommer:'winter',herbst:'fruehling'}[north];
}
export function clockPeriod(date=new Date()){
  const d=date instanceof Date?date:new Date(date);
  if(!Number.isFinite(d.getTime()))throw new Error('Ungültiger Empfehlungszeitpunkt.');
  const hour=d.getHours();
  return hour>=17||hour<5?'abend':'tag';
}
export function normalizedOccasion(raw){
  const key=norm(raw);
  return key in alias?key:(key==='kein_anlass'||!key?'kein_anlass':'sonstiges');
}
function occasionPart(fragrance,occasion,freeText=''){
  if(!occasion||occasion==='kein_anlass')return fallback('Anlass neutral','Kein Anlass angegeben');
  const tags=(fragrance.occasions||[]).map(norm);
  const targets=alias[occasion]??[];
  const custom=norm(freeText);
  if(occasion==='sonstiges'&&custom){
    if(tags.includes(custom))return {value:1,label:'Anlass passend',details:`Direkter Treffer: ${freeText}`};
    return fallback('Anlass offen',`Für „${freeText}“ liegen keine passenden Anlass-Tags vor`);
  }
  if(!tags.length)return fallback('Anlass offen','Im Katalog fehlen Anlass-Tags');
  if(tags.includes(occasion))return {value:1,label:'Anlass passend',details:`Tag „${occasion}“ vorhanden`};
  const alt=targets.find(t=>tags.includes(t));
  if(alt)return {value:0.8,label:'Anlass ähnlich',details:`Verwandter Anlass-Tag „${alt}“`};
  return {value:0.25,label:'Anlass weniger passend',details:'Kein passender Anlass-Tag vorhanden'};
}
function weatherPart(fragrance,temperature){
  if(!finite(temperature))return fallback('Wetter neutral','Temperatur fehlt oder ist offline nicht verfügbar');
  const tags=(fragrance.seasons||[]).map(norm);
  if(!tags.length)return fallback('Wetter offen','Katalog enthält keine Jahreszeiten-Tags');
  // Vereinfachte saisonale Temperaturheuristik; keine belegte Duftwissenschaft.
  const candidates=temperature<=8?['winter']:temperature<=15?['herbst','fruehling']:temperature<=22?['fruehling','herbst']:['sommer'];
  const matched=candidates.find(t=>tags.includes(t));
  return matched?{value:1,label:'Temperatur passend',details:`${temperature} °C, vorläufig passend zu „${matched}“`}
    :{value:0.35,label:'Temperatur eher unpassend',details:`${temperature} °C, kein Tag aus ${candidates.join(' / ')}`};
}
function timePart(fragrance,when){
  const tags=(fragrance.occasions||[]).map(norm);
  if(!tags.length)return fallback('Tageszeit offen','Keine Anlass-Tags für die Tageszeit vorhanden');
  const period=clockPeriod(when);
  const candidates=period==='abend'?['abend','date','dinner','konzert','feier']:['alltag','business','homeoffice','freizeit','urlaub'];
  const matched=candidates.find(t=>tags.includes(t));
  return matched?{value:1,label:'Tageszeit passend',details:`${period==='abend'?'Abend/Nacht':'Tag'}: Tag „${matched}“`}
    :{value:0.35,label:'Tageszeit weniger passend',details:`${period==='abend'?'Abend/Nacht':'Tag'}: kein zugehöriger Anlass-Tag`};
}
function ratingPart(tests){
  const vals=tests.map(t=>Number(t.overall)).filter(v=>finite(v)&&v>=1&&v<=5);
  // Number(null) ist 0, wird durch >=1 ausgeschlossen.
  if(!vals.length)return fallback('Bewertung neutral','Noch keine eigene numerische Gesamtbewertung');
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  return {value:clamp((avg-1)/4),label:'Deine Bewertung',details:`Ø ${avg.toFixed(1).replace('.',',')}/5 aus ${vals.length} Test${vals.length===1?'':'s'}`};
}
function seasonPart(fragrance,when,latitude){
  const tags=(fragrance.seasons||[]).map(norm);
  if(!tags.length)return fallback('Jahreszeit offen','Keine saisonalen Eignungs-Tags vorhanden');
  const season=seasonForDate(when,latitude);
  return tags.includes(season)?{value:1,label:'Jahreszeit passend',details:`Tag „${season}“ vorhanden`}
    :{value:0.3,label:'Jahreszeit weniger passend',details:`Kein Tag für „${season}“ vorhanden`};
}
function profilePart(fragrance,traits){
  const values=unique((traits||[]).map(norm).filter(Boolean)).slice(0,5);
  if(!values.length)return fallback('Profil neutral','Keine persönlichen Eigenschaften hinterlegt');
  // Nur ausdrücklich gleiche Wörter / Phrasen zählen. Keine erfundenen psychologischen Zuordnungen.
  const words=[...(fragrance.tags||[]),...(fragrance.notes||[])].map(norm);
  const matches=values.filter(v=>words.some(w=>w===v));
  if(!matches.length)return fallback('Profil neutral','Kein wörtlicher Treffer zwischen Eigenschaften und Duftnoten/-Tags');
  return {value:clamp(0.5+0.5*(matches.length/values.length)),label:'Profiltreffer',details:`Gleiche Merkmale: ${matches.join(', ')} (maximal 5 % Einfluss)`};
}
function shortReason(parts){
  const lines=[];
  for(const key of ['occasion','weather','time','rating','season','profile']){
    if(key==='profile' && parts[key].value===0.5)continue;
    if(parts[key].value>=0.8)lines.push(parts[key].label);
  }
  return lines.length?lines.slice(0,3).join(' · '):'Wenig eindeutige Eignungsdaten, neutrale Annahmen';
}
export function recommend({catalog=[],collections=[],approvals=[],tests=[],profile,occasion='kein_anlass',customOccasion='',temperature=null,when=new Date(),latitude=50.87,includeOrdered=false,approvedOnly=false}={}){
  if(!profile?.id)return [];
  const at=when instanceof Date?when:new Date(when);
  if(!Number.isFinite(at.getTime()))throw new Error('Ungültiger Empfehlungszeitpunkt.');
  const collectionById=new Map(collections.filter(x=>x.profileId===profile.id).map(x=>[x.fragranceId,x]));
  const approvedById=new Map(approvals.filter(x=>x.profileId===profile.id).map(x=>[x.fragranceId,x.approved]));
  const testsById=new Map();
  for(const t of tests.filter(x=>x.profileId===profile.id)){
    if(!testsById.has(t.fragranceId))testsById.set(t.fragranceId,[]);
    testsById.get(t.fragranceId).push(t);
  }
  const desired=normalizedOccasion(occasion);
  const result=[];
  for(const f of catalog){
    const item=collectionById.get(f.id);
    if(!item||!(item.status==='vorhanden'||includeOrdered&&item.status==='bestellt'))continue;
    const approval=approvedById.has(f.id)?approvedById.get(f.id):null;
    if(approvedOnly&&profile.approver?.mode==='named'&&approval!==true)continue;
    const parts={
      occasion:occasionPart(f,desired,customOccasion),weather:weatherPart(f,temperature),
      time:timePart(f,at),rating:ratingPart(testsById.get(f.id)||[]),
      season:seasonPart(f,at,latitude),profile:profilePart(f,profile.traits)
    };
    const breakdown=Object.fromEntries(Object.entries(BASE_WEIGHTS).map(([key,w])=>[key,{...parts[key],weight:w*0.95}]));
    breakdown.profile={...parts.profile,weight:PROFILE_WEIGHT};
    const score=Object.values(breakdown).reduce((sum,v)=>sum+v.value*v.weight,0);
    result.push({fragrance:f,score:Math.round(score*10)/10,breakdown,reason:shortReason(parts),approval,status:item.status});
  }
  return result.sort((a,b)=>b.score-a.score||a.fragrance.brand.localeCompare(b.fragrance.brand,'de')||a.fragrance.name.localeCompare(b.fragrance.name,'de')||a.fragrance.id.localeCompare(b.fragrance.id,'de')).slice(0,3);
}
