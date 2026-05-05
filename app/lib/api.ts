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
    if (!res.ok) return null;
    const data = await res.json();
    setTokens(data.access_token, refreshToken);
    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = accessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${API_BASE}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e: any) {
    throw new Error(`Network error: ${e.message}`);
  }

  if (res.status === 401) {
    const newToken = await doRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (res.status === 401) {
    clearTokens();
    throw new Error('Unauthorized');
  }

  // Safely get response body
  let body: string;
  try {
    body = await res.text();
  } catch {
    body = '';
  }

  // Try to parse as JSON
  let data: any;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    // Not JSON — could be HTML error page
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 100)}`);
    }
    throw new Error(`Expected JSON, got: ${body.slice(0, 100)}`);
  }

  if (!res.ok) {
    const msg = data?.detail?.[0]?.msg || data?.detail || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
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

//   getPublicKey: async (userId: string): Promise<UserPublicKey> => {
//     return fetchApi(`/users/${userId}/public-key`);
//   },

  getPublicKey: async (userId: string): Promise<UserPublicKey> => {
    console.log('API: Fetching public key for', userId);
    const res = await fetchApi(`/users/${userId}/public-key`);
    console.log('RAW PUBLIC KEY RESPONSE:', res);
    return res;
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