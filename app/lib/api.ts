import type {
  AuthResponse,
  TokenResponse,
  UserProfile,
  UserPublicInfo,
  UserPublicKey,
  EncryptedPayload,
  MessageResponse,
  ConversationSummary,
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://whisperbox.koyeb.app';

let accessToken: string | null = null;

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('refresh_token');
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('access_token', access);
    sessionStorage.setItem('refresh_token', refresh);
  }
}

export function clearTokens() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  }
}

if (typeof window !== 'undefined') {
  accessToken = sessionStorage.getItem('access_token');
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data: TokenResponse = await res.json();
    setTokens(data.access_token, refreshToken);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = accessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    const newToken = await doRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  if (res.status === 401) {
    clearTokens();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: async (body: {
    display_name: string;
    username: string;
    password: string;
    public_key: string;
    wrapped_private_key: string;
    pbkdf2_salt: string;
  }): Promise<AuthResponse> => {
    return fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    return fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },

  me: async (): Promise<UserProfile | null> => {
    try {
      return await fetchApi('/auth/me');
    } catch {
      return null;
    }
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    return fetchApi('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
  },

  logout: async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await fetchApi('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
      } catch {
        // ignore
      }
    }
    clearTokens();
  },

  getPublicKey: async (userId: string): Promise<UserPublicKey> => {
    return fetchApi(`/users/${userId}/public-key`);
  },

  searchUsers: async (q: string): Promise<UserPublicInfo[]> => {
    return fetchApi(`/users/search?q=${encodeURIComponent(q)}`);
  },

  sendMessage: async (to: string, payload: EncryptedPayload): Promise<MessageResponse> => {
    return fetchApi('/messages', { method: 'POST', body: JSON.stringify({ to, payload }) });
  },

  getConversations: async (): Promise<ConversationSummary[]> => {
    return fetchApi('/conversations');
  },

  getMessages: async (userId: string, before?: string, limit: number = 50): Promise<MessageResponse[]> => {
    let url = `/conversations/${userId}/messages?limit=${limit}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    return fetchApi(url);
  },
};