import { openDB, DBSchema } from 'idb';

interface WhisperBoxDB extends DBSchema {
  keys: {
    key: string;
    value: { privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey };
  };
}

const DB_NAME = 'whisperbox';
const DB_VERSION = 1;

async function getDB() {
  return openDB<WhisperBoxDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
    },
  });
}

export async function storeKeys(keys: { privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey }): Promise<void> {
  const db = await getDB();
  await db.put('keys', keys, 'identity');
}

export async function getKeys(): Promise<{ privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey } | undefined> {
  const db = await getDB();
  return db.get('keys', 'identity');
}

export async function deleteKeys(): Promise<void> {
  const db = await getDB();
  await db.delete('keys', 'identity');
}