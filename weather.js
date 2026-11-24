// Nur der manuell angegebene Ortsname wird an Open-Meteo übertragen; keine GPS-Ortung.
const SEARCH='https://geocoding-api.open-meteo.com/v1/search';
const FORECAST='https://api.open-meteo.com/v1/forecast';
async function api(url,signal){
  const response=await fetch(url,{signal,cache:'no-store'});
  if(!response.ok)throw new Error(`Wetterdienst nicht erreichbar (HTTP ${response.status})`);
  const json=await response.json();
  if(json.error)throw new Error('Wetterdienst meldet einen Fehler.');
  return json;
}
export async function weatherAt(city,{when=new Date(),signal}={}){
  const q=String(city??'').trim();
  if(q.length<2||q.length>100)throw new Error('Bitte einen gültigen Ortsnamen eingeben.');
  const placeSearch=new URL(SEARCH);placeSearch.searchParams.set('name',q);placeSearch.searchParams.set('count','5');placeSearch.searchParams.set('language','de');placeSearch.searchParams.set('format','json');
  const geo=await api(placeSearch.href,signal);
  const matches=geo.results||[];
  const place=matches.find(x=>x.country_code==='DE'&&x.name.toLocaleLowerCase('de-DE')===q.toLocaleLowerCase('de-DE'))??matches.find(x=>x.country_code==='DE')??matches[0];
  if(!place||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))throw new Error('Ort konnte nicht gefunden werden.');
  const date=when instanceof Date?when:new Date(when);
  if(!Number.isFinite(date.getTime()))throw new Error('Ungültiger Zeitpunkt.');
  const url=new URL(FORECAST);
  url.searchParams.set('latitude',String(place.latitude));url.searchParams.set('longitude',String(place.longitude));url.searchParams.set('timezone','auto');
  url.searchParams.set('current','temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code');
  url.searchParams.set('hourly','temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code');
  const report=await api(url.href,signal);
  // Bei einer nahen geplanten Zeit wird eine stündliche Prognose verwendet.
  // Datum/Zeit des Prognoseorts wird im dortigen timezone-Kontext formatiert.
  const timeZone=report.timezone||'Europe/Berlin';
  const target=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');
  const hours=report.hourly?.time||[];
  const now=new Date();
  const useCurrent=Math.abs(date-now)<60*60*1000;
  const idx=useCurrent?-1:hours.findIndex(s=>String(s).slice(0,13)===target.slice(0,13));
  if(!useCurrent&&idx<0)throw new Error('Für diesen Zeitpunkt liegt keine Wetterprognose vor. Temperatur bitte manuell eingeben.');
  const w=idx>=0?{
    temperature:report.hourly.temperature_2m?.[idx],feelsLike:report.hourly.apparent_temperature?.[idx],humidity:report.hourly.relative_humidity_2m?.[idx],precipitation:report.hourly.precipitation_probability?.[idx],weatherCode:report.hourly.weather_code?.[idx],time:hours[idx],forecast:true
  }: {
    temperature:report.current?.temperature_2m,feelsLike:report.current?.apparent_temperature,humidity:report.current?.relative_humidity_2m,precipitation:report.current?.precipitation,weatherCode:report.current?.weather_code,time:report.current?.time,forecast:false
  };
  if(!Number.isFinite(w.temperature))throw new Error('Temperatur fehlt in den Wetterdaten.');
  return {...w,latitude:place.latitude,longitude:place.longitude,city:place.name,country:place.country_code,source:'Open-Meteo',retrievedAt:new Date().toISOString()};
}
