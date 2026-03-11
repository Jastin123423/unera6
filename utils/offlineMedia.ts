// utils/offlineMedia.ts
const SOUND_DB_NAME = 'UneraOfflineMediaDB';
const SOUND_DB_VERSION = 1;
const SOUND_STORE = 'offline_sounds';

let soundDbInstance: IDBDatabase | null = null;

export type OfflineSoundRecord = {
  id: string;
  name: string;
  originalUrl: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  duration?: number;
  creatorName?: string;
  coverImage?: string;
  soundKey?: string;
};

export type OfflineSoundMeta = {
  id: string;
  name: string;
  url: string; // blob url
  originalUrl: string;
  duration?: number;
  creatorName?: string;
  coverImage?: string;
  soundKey?: string;
  size: number;
  updatedAt: number;
};

const openSoundDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (soundDbInstance) {
      resolve(soundDbInstance);
      return;
    }

    const request = indexedDB.open(SOUND_DB_NAME, SOUND_DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      soundDbInstance = request.result;
      resolve(soundDbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(SOUND_STORE)) {
        const store = db.createObjectStore(SOUND_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };
  });
};

export const preloadSoundForOffline = async (sound: {
  id: string | number;
  name: string;
  url: string;
  originalUrl?: string;
  duration?: number;
  creatorName?: string;
  coverImage?: string;
  soundKey?: string;
}) => {
  if (!sound.url) throw new Error('Missing sound URL');

  const res = await fetch(sound.url, {
    cache: 'force-cache',
    headers: { Accept: 'audio/*,*/*' },
  });

  if (!res.ok) {
    throw new Error(`Failed to download sound: ${res.status}`);
  }

  const blob = await res.blob();
  const db = await openSoundDB();

  const record: OfflineSoundRecord = {
    id: String(sound.id),
    name: sound.name,
    originalUrl: sound.originalUrl || sound.url,
    blob,
    mimeType: blob.type || 'audio/mpeg',
    size: blob.size,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    duration: sound.duration,
    creatorName: sound.creatorName,
    coverImage: sound.coverImage,
    soundKey: sound.soundKey,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([SOUND_STORE], 'readwrite');
    const store = tx.objectStore(SOUND_STORE);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return true;
};

export const getOfflineSounds = async (): Promise<OfflineSoundMeta[]> => {
  const db = await openSoundDB();

  const rows = await new Promise<OfflineSoundRecord[]>((resolve, reject) => {
    const tx = db.transaction([SOUND_STORE], 'readonly');
    const store = tx.objectStore(SOUND_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  return rows
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((row) => ({
      id: row.id,
      name: row.name,
      url: URL.createObjectURL(row.blob),
      originalUrl: row.originalUrl,
      duration: row.duration,
      creatorName: row.creatorName,
      coverImage: row.coverImage,
      soundKey: row.soundKey,
      size: row.size,
      updatedAt: row.updatedAt,
    }));
};

export const deleteOfflineSound = async (id: string) => {
  const db = await openSoundDB();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([SOUND_STORE], 'readwrite');
    const store = tx.objectStore(SOUND_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const hasOfflineSound = async (id: string | number) => {
  const db = await openSoundDB();

  const row = await new Promise<OfflineSoundRecord | undefined>((resolve, reject) => {
    const tx = db.transaction([SOUND_STORE], 'readonly');
    const store = tx.objectStore(SOUND_STORE);
    const req = store.get(String(id));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return !!row;
};
