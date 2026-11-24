import {STORES, migrateLegacy, validateBackup, planAdditiveImport} from './model.js';
const DATABASE_NAME='scentos-beta10-local';
const DATABASE_VERSION=1;
const KEY_FIELDS={catalog:'id',profiles:'id',collections:'key',approvals:'key',tests:'id',wearLogs:'id',settings:'key'};
let opened;
const asPromise=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const completion=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('Transaktion abgebrochen.'));tx.onerror=()=>{};});
export function dbOpen(){
  if(!opened) opened=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      for(const [store,keyPath] of Object.entries(KEY_FIELDS))if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath});
      const catalog=req.transaction.objectStore('catalog');
      if(!catalog.indexNames.contains('fingerprint'))catalog.createIndex('fingerprint','fingerprint',{unique:true});
      for(const store of ['collections','approvals','tests','wearLogs']){
        const s=req.transaction.objectStore(store);
        if(!s.indexNames.contains('profileId'))s.createIndex('profileId','profileId',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>{opened=null;reject(req.error);};
  });
  return opened;
}
export async function getAll(store){const db=await dbOpen();const tx=db.transaction(store,'readonly');const val=await asPromise(tx.objectStore(store).getAll());await completion(tx);return val;}
export async function get(store,id){const db=await dbOpen();const tx=db.transaction(store,'readonly');const val=await asPromise(tx.objectStore(store).get(id));await completion(tx);return val;}
export async function put(store,item){const db=await dbOpen();const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(item);await completion(tx);}
export async function remove(store,key){const db=await dbOpen();const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);await completion(tx);}
export async function readState(){const parts=await Promise.all(STORES.map(async name=>[name,await getAll(name)]));return {format:'scentos-local-v1',exportedAt:new Date().toISOString(),...Object.fromEntries(parts)};}
export async function seedIfEmpty(legacy){
  const db=await dbOpen();
  // Read all startup markers in one transaction. A partially populated DB must never be silently reset.
  const tx=db.transaction(STORES,'readwrite');const done=completion(tx);const settings=tx.objectStore('settings');
  const seeded=await asPromise(settings.get('seedVersion'));
  const count=await asPromise(tx.objectStore('catalog').count());
  const profiles=await asPromise(tx.objectStore('profiles').count());
  if(!seeded && count===0 && profiles===0){
    const converted=migrateLegacy(legacy);
    for(const store of STORES){for(const item of converted[store])tx.objectStore(store).add(item);}
  } else if (!seeded) settings.put({key:'seedVersion',value:'pre-existing-state'});
  await done;
}
// Import is safe and additive only. Existing records are never overwritten.
// Duplicate fingerprints (even across different IDs) are skipped rather than overwriting a different record.
export async function safeImport(raw){
  const data=raw?.format==='scentos-local-v1'?validateBackup(raw):migrateLegacy(raw);
  const current=await readState();
  const plan=planAdditiveImport(data,current);
  const db=await dbOpen();const tx=db.transaction(STORES,'readwrite');const done=completion(tx);
  try {
    for(const store of STORES) for(const row of plan.insert[store]) tx.objectStore(store).add(row);
  }catch(e){tx.abort();throw e;}
  await done;
  return {added:plan.added,skipped:plan.skipped};
}
