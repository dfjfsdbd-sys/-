// تخزين على الجهاز: IndexedDB أساسي (يتّسع للصور والسجلات)، وlocalStorage احتياط إن لم يتوفّر
const DB_NAME = 'manzumati';
const STORE = 'kv';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no-idb')); return; }
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('blocked'));
  });
  return dbp;
}

export async function kvGet(key) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  } catch {
    try { const raw = localStorage.getItem(`${DB_NAME}:${key}`); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
  }
}

export async function kvSet(key, value) {
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    try { localStorage.setItem(`${DB_NAME}:${key}`, JSON.stringify(value)); return true; } catch { return false; }
  }
}

export async function kvDel(key) {
  try {
    const db = await open();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* */ }
}
