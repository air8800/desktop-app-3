import type { User } from './auth';

export interface StoredSession {
  user: User;
  accessToken: string;
  refreshToken?: string;
  shopId?: string;
}

const SESSION_KEY = 'user-session';
const AUTH_KEY = 'auth-token';
const AUTH_FLAG = 'isAuthenticated';
const SHOP_KEY = 'shop-id';
const REFRESH_KEY = 'auth-refresh-token';

export async function getStoredSession(): Promise<StoredSession | null> {
  try {
    if (window.electron?.authGetSession) {
      const result = await window.electron.authGetSession();
      if (result?.success && result.session) {
        return result.session as StoredSession;
      }
    }
  } catch {
    /* fall through to localStorage */
  }

  const authStatus = localStorage.getItem(AUTH_FLAG);
  const userSession = localStorage.getItem(SESSION_KEY);
  const token = localStorage.getItem(AUTH_KEY);

  if (authStatus !== 'true' || !userSession || !token) {
    return null;
  }

  const user = JSON.parse(userSession) as User;
  return {
    user,
    accessToken: token,
    refreshToken: localStorage.getItem(REFRESH_KEY) || undefined,
    shopId: localStorage.getItem(SHOP_KEY) || user.shopId,
  };
}

export async function setStoredSession(session: StoredSession): Promise<void> {
  localStorage.setItem(AUTH_FLAG, 'true');
  localStorage.setItem(SESSION_KEY, JSON.stringify(session.user));
  localStorage.setItem(AUTH_KEY, session.accessToken);
  if (session.refreshToken) {
    localStorage.setItem(REFRESH_KEY, session.refreshToken);
  }
  if (session.shopId) {
    localStorage.setItem(SHOP_KEY, session.shopId);
    session.user.shopId = session.shopId;
  }

  if (window.electron?.authSetSession) {
    await window.electron.authSetSession(session);
  }
}

export async function clearStoredSession(): Promise<void> {
  localStorage.removeItem(AUTH_FLAG);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SHOP_KEY);

  if (window.electron?.authClearSession) {
    await window.electron.authClearSession();
  }
}
