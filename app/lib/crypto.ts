import { EncryptedPayload } from '../types';

/* =========================
   Base64 Helpers
========================= */

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

/* =========================
   Key Generation
========================= */

export async function generateIdentityKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  return window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/* =========================
   Password-based Key Derivation
========================= */

async function deriveWrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/* =========================
   Private Key Wrapping
========================= */

export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string
): Promise<{ wrappedPrivateKey: string; salt: string }> {
  const salt = new Uint8Array(16);
  window.crypto.getRandomValues(salt);

  const wrappingKey = await deriveWrappingKey(password, salt);

  const wrapped = await window.crypto.subtle.wrapKey(
    'pkcs8',
    privateKey,
    wrappingKey,
    'AES-KW'
  );

  return {
    wrappedPrivateKey: bufferToBase64(wrapped),
    salt: bufferToBase64(salt),
  };
}

export async function unwrapPrivateKey(
  wrappedPrivateKey: string,
  salt: string,
  password: string
): Promise<CryptoKey> {
  // ✅ Fix: convert ArrayBuffer → Uint8Array
  const saltBytes = new Uint8Array(base64ToBuffer(salt));

  const wrappingKey = await deriveWrappingKey(password, saltBytes);

  return window.crypto.subtle.unwrapKey(
    'pkcs8',
    base64ToBuffer(wrappedPrivateKey),
    wrappingKey,
    'AES-KW',
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['decrypt', 'unwrapKey']
  );
}

/* =========================
   Public Key Handling
========================= */

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey('jwk', key);
  return bufferToBase64(new TextEncoder().encode(JSON.stringify(jwk)));
}

export async function importPublicKey(input: string): Promise<CryptoKey> {
  // Try JWK
  try {
    const decoded = new TextDecoder().decode(base64ToBuffer(input));
    const jwk = JSON.parse(decoded);

    if (jwk && jwk.kty) {
      return window.crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['wrapKey']
      );
    }
  } catch {}

  // Try SPKI (DER base64)
  try {
    const binary = base64ToBuffer(input);

    return window.crypto.subtle.importKey(
      'spki',
      binary,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['wrapKey']
    );
  } catch {
    throw new Error('Unsupported public key format');
  }
}

/* =========================
   Encryption
========================= */

export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<EncryptedPayload> {
  const payload = JSON.stringify({
    text: plaintext,
    timestamp: Date.now(),
    nonce: window.crypto.randomUUID(),
  });

  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(payload)
  );

  const encryptedKey = await window.crypto.subtle.wrapKey(
    'raw',
    aesKey,
    recipientPublicKey,
    { name: 'RSA-OAEP' }
  );

  const encryptedKeyForSelf = await window.crypto.subtle.wrapKey(
    'raw',
    aesKey,
    senderPublicKey,
    { name: 'RSA-OAEP' }
  );

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
    encryptedKey: bufferToBase64(encryptedKey),
    encryptedKeyForSelf: bufferToBase64(encryptedKeyForSelf),
  };
}

/* =========================
   Decryption
========================= */

const seenNonces = new Set<string>();
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export async function decryptMessage(
  payload: EncryptedPayload,
  privateKey: CryptoKey,
  isSentByMe: boolean
): Promise<string> {
  async function tryUnwrap(keyData: string) {
    return window.crypto.subtle.unwrapKey(
      'raw',
      base64ToBuffer(keyData),
      privateKey,
      { name: 'RSA-OAEP' },
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  let aesKey: CryptoKey | null = null;

  try {
    aesKey = await tryUnwrap(payload.encryptedKey);
  } catch {}

  if (!aesKey) {
    try {
      aesKey = await tryUnwrap(payload.encryptedKeyForSelf);
    } catch {}
  }

  if (!aesKey) {
    throw new Error('Unable to unwrap AES key');
  }

  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  const data = JSON.parse(new TextDecoder().decode(decrypted));

  // Replay protection (soft)
  if (Date.now() - data.timestamp > REPLAY_WINDOW_MS) {
    console.warn('Message expired, but allowing');
  }

  if (seenNonces.has(data.nonce)) {
    return data.text;
  }

  seenNonces.add(data.nonce);
  if (seenNonces.size > 10000) seenNonces.clear();

  return data.text;
}