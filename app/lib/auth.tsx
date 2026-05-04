'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api, setTokens, clearTokens } from './api';
import { storeKeys, deleteKeys, getKeys } from './db';
import { generateIdentityKeyPair, wrapPrivateKey, unwrapPrivateKey, exportPublicKey, base64ToBuffer } from './crypto';
import type { UserProfile } from '../types';

interface AuthUser {
  id: string;
  username: string;
  display_name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (displayName: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function profileToUser(profile: UserProfile): AuthUser {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const hasToken = typeof window !== 'undefined' && !!sessionStorage.getItem('access_token');
      if (!hasToken) {
        setIsLoading(false);
        return;
      }

      const profile = await api.me();
      if (!profile) {
        clearTokens();
        await deleteKeys();
        setIsLoading(false);
        return;
      }

      const keys = await getKeys();
      if (!keys) {
        clearTokens();
        await deleteKeys();
        setIsLoading(false);
        return;
      }

      setUser(profileToUser(profile));
      setIsLoading(false);
    }

    init();
  }, []);

const login = useCallback(async (username: string, password: string) => {
  const res = await api.login(username, password);

  const existingKeys = await getKeys();

  if (!existingKeys) {
    // First time on this device → restore from server
    const privateKey = await unwrapPrivateKey(
      res.user.wrapped_private_key,
      res.user.pbkdf2_salt,
      password
    );

    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', privateKey);
    const publicKeyJwk = JSON.parse(
      new TextDecoder().decode(base64ToBuffer(res.user.public_key))
    );

    await storeKeys({ privateKeyJwk, publicKeyJwk });
  } 
  // else: do nothing → keep existing keys

  setTokens(res.access_token, res.refresh_token);
  setUser(profileToUser(res.user));
}, []);

  const register = useCallback(async (displayName: string, username: string, password: string) => {
    const keyPair = await generateIdentityKeyPair();
    const wrapped = await wrapPrivateKey(keyPair.privateKey, password);
    const publicKeyStr = await exportPublicKey(keyPair.publicKey);

    const res = await api.register({
      display_name: displayName,
      username,
      password,
      public_key: publicKeyStr,
      wrapped_private_key: wrapped.wrappedPrivateKey,
      pbkdf2_salt: wrapped.salt,
    });

    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    await storeKeys({ privateKeyJwk, publicKeyJwk });

    setTokens(res.access_token, res.refresh_token);
    setUser(profileToUser(res.user));
  }, []);

  // const logout = useCallback(async () => {
  //   await api.logout();
  //   await deleteKeys();
  //   setUser(null);
  // }, []);

const logout = useCallback(async () => {
  await api.logout();
  // DO NOT delete keys
  // await deleteKeys();
  setUser(null);
}, []);



  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}