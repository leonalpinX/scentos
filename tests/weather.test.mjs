import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherAt} from '../weather.js';
const oldFetch=globalThis.fetch;
function fakeFetch(url){
  const x=new URL(url);
  if(x.hostname==='geocoding-api.open-meteo.com')return Promise.resolve({ok:true,json:async()=>({results:[{name:'Kerpen',latitude:50.87,longitude:6.7,country_code:'DE'}]})});
  if(x.hostname==='api.open-meteo.com')return Promise.resolve({ok:true,json:async()=>({timezone:'Europe/Berlin',current:{temperature_2m:6,apparent_temperature:3,relative_humidity_2m:75,precipitation:0,weather_code:3,time:'2026-11-24T12:00'},hourly:{time:['2026-11-25T12:00'],temperature_2m:[9],apparent_temperature:[7],relative_humidity_2m:[73],precipitation_probability:[20],weather_code:[3]}})});
  throw Error('Unexpected URL');
}
test('weather fetch uses city name and Open-Meteo, no device GPS',async()=>{globalThis.fetch=fakeFetch;try{const w=await weatherAt('Kerpen',{when:new Date()});assert.equal(w.city,'Kerpen');assert.equal(w.temperature,6);assert.equal(w.feelsLike,3);assert.equal(w.humidity,75);assert.equal(w.source,'Open-Meteo');}finally{globalThis.fetch=oldFetch;}});
test('future forecast uses matching hourly forecast, not current weather',async()=>{globalThis.fetch=fakeFetch;try{const w=await weatherAt('Kerpen',{when:new Date('2026-11-25T12:00:00+01:00')});assert.equal(w.forecast,true);assert.equal(w.temperature,9);assert.equal(w.precipitation,20);}finally{globalThis.fetch=oldFetch;}});
test('future out of forecast range produces clear manual fallback error',async()=>{globalThis.fetch=fakeFetch;try{await assert.rejects(()=>weatherAt('Kerpen',{when:new Date('2026-12-25T10:00:00+01:00')}),/keine Wetterprognose/);}finally{globalThis.fetch=oldFetch;}});
