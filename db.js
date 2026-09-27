const DB_NAME='shooting-now-db';
const DB_VERSION=1;
const STORE='events';

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

export async function listEvents(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
}

export async function putEvent(event){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(event);
    tx.oncomplete=()=>resolve(event);
    tx.onerror=()=>reject(tx.error);
  });
}

export async function removeEvent(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

export async function migrateLegacy(){
  const raw=localStorage.getItem('shooting-events-v2');
  if(!raw) return 0;
  try{
    const items=JSON.parse(raw)||[];
    let count=0;
    for(const item of items){if(item?.id){await putEvent(item);count++;}}
    localStorage.removeItem('shooting-events-v2');
    return count;
  }catch{return 0;}
}
