// Keeps the uploaded magazine PDF in the browser (IndexedDB) so it reloads instantly.
const DB = "nrim-magazine";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      rej(new Error("IndexedDB unavailable"));
      return;
    }
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (err) {
      rej(err);
    }
  });
}

export async function savePdf(file: File): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ name: file.name, blob: file }, "current");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn("Could not save PDF to IndexedDB:", err);
  }
}

export async function loadPdf(): Promise<{ name: string; blob: Blob } | null> {
  try {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return null;
    }
    const db = await open();
    return new Promise((res) => {
      const r = db.transaction(STORE).objectStore(STORE).get("current");
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

export async function clearPdf(): Promise<void> {
  try {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete("current");
  } catch {
    // ignore
  }
}
