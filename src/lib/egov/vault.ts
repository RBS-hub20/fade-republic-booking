"use client";

/**
 * Local-only document vault.
 *
 * Documents never leave the device: bytes are encrypted with AES-GCM 256 via
 * Web Crypto and the ciphertext is parked in IndexedDB. The master key is a
 * non-extractable `CryptoKey` that is structured-cloned into IndexedDB, so it
 * can be used to decrypt but cannot be read out of the browser.
 *
 * Where IndexedDB is unavailable (private-mode quirks, SSR-less test runners)
 * we fall back to localStorage. That fallback has to export the key to persist
 * it, which is strictly weaker — `VaultStatus.backend` reports which one is
 * live so the UI can say so honestly.
 */

const DB_NAME = "egov-superagent-vault";
const DB_VERSION = 1;
const DOC_STORE = "documents";
const KEY_STORE = "keys";
const MASTER_KEY_ID = "master";
const LS_DOCS = "egov.vault.documents";
const LS_KEY = "egov.vault.masterKey";

export type VaultBackend = "indexeddb" | "localstorage";

export interface VaultDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: string;
  /** True for the pre-seeded demo entries that have no real bytes behind them. */
  seeded: boolean;
}

interface StoredDoc extends VaultDoc {
  iv: number[];
  ciphertext: number[];
}

export interface VaultStatus {
  backend: VaultBackend;
  algorithm: "AES-GCM-256";
  unlocked: boolean;
}

let backend: VaultBackend = "indexeddb";

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

/* ------------------------------------------------------------------ keys -- */

async function generateKey(extractable: boolean): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, extractable, ["encrypt", "decrypt"]);
}

let keyPromise: Promise<CryptoKey> | null = null;

async function loadMasterKey(): Promise<CryptoKey> {
  if (idbAvailable()) {
    try {
      const existing = await tx<CryptoKey | undefined>(KEY_STORE, "readonly", (s) => s.get(MASTER_KEY_ID));
      if (existing) return existing;
      // Non-extractable: usable for encrypt/decrypt, impossible to export.
      const key = await generateKey(false);
      await tx(KEY_STORE, "readwrite", (s) => s.put(key, MASTER_KEY_ID));
      return key;
    } catch {
      backend = "localstorage";
    }
  } else {
    backend = "localstorage";
  }

  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", bytes, "AES-GCM", true, ["encrypt", "decrypt"]);
  }
  const key = await generateKey(true);
  const exported = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  let binary = "";
  exported.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  localStorage.setItem(LS_KEY, btoa(binary));
  return key;
}

function masterKey(): Promise<CryptoKey> {
  if (!keyPromise) keyPromise = loadMasterKey();
  return keyPromise;
}

/* ------------------------------------------------------------- documents -- */

function readLocal(): StoredDoc[] {
  try {
    return JSON.parse(localStorage.getItem(LS_DOCS) ?? "[]") as StoredDoc[];
  } catch {
    return [];
  }
}

function writeLocal(docs: StoredDoc[]) {
  localStorage.setItem(LS_DOCS, JSON.stringify(docs));
}

async function putDoc(doc: StoredDoc): Promise<void> {
  if (backend === "indexeddb" && idbAvailable()) {
    try {
      await tx(DOC_STORE, "readwrite", (s) => s.put(doc));
      return;
    } catch {
      backend = "localstorage";
    }
  }
  const docs = readLocal().filter((d) => d.id !== doc.id);
  writeLocal([...docs, doc]);
}

async function allDocs(): Promise<StoredDoc[]> {
  if (backend === "indexeddb" && idbAvailable()) {
    try {
      return (await tx<StoredDoc[]>(DOC_STORE, "readonly", (s) => s.getAll())) ?? [];
    } catch {
      backend = "localstorage";
    }
  }
  return readLocal();
}

function strip(doc: StoredDoc): VaultDoc {
  const { iv: _iv, ciphertext: _ciphertext, ...meta } = doc;
  return meta;
}

/** Encrypt and store a file. Returns the metadata row for the UI. */
export async function addDocument(file: File): Promise<VaultDoc> {
  const key = await masterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));

  const doc: StoredDoc = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    addedAt: new Date().toISOString(),
    seeded: false,
    iv: Array.from(iv),
    ciphertext: Array.from(ciphertext),
  };
  await putDoc(doc);
  return strip(doc);
}

/** Seed the three demo documents once, so a fresh browser has a populated vault. */
export async function seedDocuments(
  seeds: readonly { name: string; type: string; size: number }[]
): Promise<void> {
  const existing = await allDocs();
  if (existing.length > 0) return;
  const key = await masterKey();
  const seededAt = Date.now();
  for (let index = 0; index < seeds.length; index++) {
    const seed = seeds[index];
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const body = new TextEncoder().encode(
      `eGov SuperAgent demo document — ${seed.name}. Encrypted locally with AES-GCM; never uploaded.`
    );
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
    await putDoc({
      id: crypto.randomUUID(),
      name: seed.name,
      type: seed.type,
      size: seed.size,
      // +index keeps the seed order stable even when the loop runs inside a ms.
      addedAt: new Date(seededAt + index).toISOString(),
      seeded: true,
      iv: Array.from(iv),
      ciphertext: Array.from(ciphertext),
    });
  }
}

export async function listDocuments(): Promise<VaultDoc[]> {
  const docs = await allDocs();
  // Files the user just added surface first (newest on top); the seeded IDs keep
  // the order they were written in so the list doesn't reshuffle on reload.
  return docs.map(strip).sort((a, b) => {
    if (a.seeded !== b.seeded) return a.seeded ? 1 : -1;
    return a.seeded ? a.addedAt.localeCompare(b.addedAt) : b.addedAt.localeCompare(a.addedAt);
  });
}

/** Decrypt a document back into a Blob (used for preview / download). */
export async function openDocument(id: string): Promise<Blob | null> {
  const doc = (await allDocs()).find((d) => d.id === id);
  if (!doc) return null;
  const key = await masterKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(doc.iv) },
    key,
    new Uint8Array(doc.ciphertext)
  );
  return new Blob([plaintext], { type: doc.type });
}

export async function removeDocument(id: string): Promise<void> {
  if (backend === "indexeddb" && idbAvailable()) {
    try {
      await tx(DOC_STORE, "readwrite", (s) => s.delete(id));
      return;
    } catch {
      backend = "localstorage";
    }
  }
  writeLocal(readLocal().filter((d) => d.id !== id));
}

export async function vaultStatus(): Promise<VaultStatus> {
  await masterKey();
  return { backend, algorithm: "AES-GCM-256", unlocked: true };
}
