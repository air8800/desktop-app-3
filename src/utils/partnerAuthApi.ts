import { supabase } from './supabase';

const PROD_API_BASE = import.meta.env.VITE_PRINTGET_API_URL || 'https://printget.in';

function getFetchBase(): string {
  // Electron main process bypasses browser CORS
  if (typeof window !== 'undefined' && window.electron?.partnerApiFetch) {
    return PROD_API_BASE;
  }
  // Vite dev server proxies /api/partner → printget.in (same origin, no CORS)
  if (import.meta.env.DEV) {
    return '';
  }
  return PROD_API_BASE;
}

export interface PartnerSignupPayload {
  name: string;
  phone: string;
  shopName: string;
  businessType: string;
  businessTypeOther?: string;
  address: string;
  googleMapsLink: string;
  latitude: number;
  longitude: number;
}

export interface AuthSessionResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
  needsOnboarding?: boolean;
  error?: string;
}

async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const payload = {
    path,
    method: options.method || 'POST',
    body: options.body,
    headers: options.headers,
  };

  try {
    if (window.electron?.partnerApiFetch) {
      const result = await window.electron.partnerApiFetch(path, payload);
      return {
        ok: result.ok,
        status: result.status,
        data: (result.data as T) ?? null,
        error: result.error,
      };
    }

    const res = await fetch(`${getFetchBase()}${path}`, {
      method: payload.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body != null ? JSON.stringify(options.body) : undefined,
    });
    const data = res.ok ? await res.json().catch(() => null) : await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, status: 0, data: null, error: message };
  }
}

function apiUnavailableMessage(status: number, apiError?: string): string {
  if (status === 0) {
    return 'Could not connect to PrintGet sign-in service. Restart the app with: npm run electron:dev';
  }
  if (status === 404) {
    return 'Partner sign-in service is not deployed yet. Contact PrintGet support.';
  }
  return apiError || 'Something went wrong. Please try again.';
}

export async function requestEmailCode(email: string): Promise<{ success: boolean; error?: string }> {
  const { ok, status, data } = await apiFetch<{ success?: boolean; message?: string; error?: string }>(
    '/api/partner/auth/request-code',
    { body: { email: email.toLowerCase() } }
  );

  if (ok && data?.success !== false) {
    return { success: true };
  }

  return {
    success: false,
    error: data?.error || apiUnavailableMessage(status),
  };
}

export async function verifyEmailCode(email: string, code: string): Promise<AuthSessionResult> {
  const { ok, status, data } = await apiFetch<{
    success?: boolean;
    access_token?: string;
    refresh_token?: string;
    user?: { id: string; email: string };
    needsOnboarding?: boolean;
    error?: string;
  }>('/api/partner/auth/verify-code', {
    body: { email: email.toLowerCase(), code },
  });

  if (ok && data?.access_token) {
    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user?.id,
      email: data.user?.email || email,
      needsOnboarding: data.needsOnboarding ?? true,
    };
  }

  return {
    success: false,
    error: data?.error || apiUnavailableMessage(status),
  };
}

export async function notifySignupComplete(
  accessToken: string,
  payload: PartnerSignupPayload
): Promise<{ success: boolean; shopId?: string; error?: string }> {
  const { ok, data } = await apiFetch<{ success?: boolean; shopId?: string; error?: string }>(
    '/api/partner/auth/complete-signup',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        name: payload.name,
        phone: payload.phone,
        shopName: payload.shopName,
        businessType: payload.businessType,
        businessTypeOther: payload.businessTypeOther,
        address: payload.address,
        googleMapsLink: payload.googleMapsLink,
        latitude: payload.latitude,
        longitude: payload.longitude,
      },
    }
  );

  if (ok && data?.success !== false) {
    return { success: true, shopId: data?.shopId };
  }

  // Welcome email API optional — shop is saved client-side regardless
  return { success: true };
}

export function getOAuthRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) {
    const useHash =
      Boolean(window.electron) ||
      window.location.protocol === 'file:' ||
      window.location.hash.startsWith('#/');
    return useHash
      ? `${window.location.origin}/#/auth/callback`
      : `${window.location.origin}/auth/callback`;
  }
  return 'https://printget.in/auth/desktop-callback';
}

export async function resolveOAuthRedirectUrl(): Promise<string> {
  if (window.electron?.prepareOAuthRedirect) {
    const result = await window.electron.prepareOAuthRedirect();
    if (result.success && result.redirectUrl) {
      return result.redirectUrl;
    }
    throw new Error(result.error || 'Could not start sign-in listener');
  }
  return getOAuthRedirectUrl();
}

export function parseOAuthCallbackUrl(url: string): {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
} {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const paramString =
    hashIndex >= 0 ? url.substring(hashIndex + 1) : queryIndex >= 0 ? url.substring(queryIndex + 1) : '';
  const params = new URLSearchParams(paramString);
  const error = params.get('error_description') || params.get('error');
  return {
    accessToken: params.get('access_token') || undefined,
    refreshToken: params.get('refresh_token') || undefined,
    error: error ? decodeURIComponent(error) : undefined,
  };
}

export async function startGoogleAuth(): Promise<{ success: boolean; url?: string; error?: string }> {
  let redirectTo: string;
  try {
    redirectTo = await resolveOAuthRedirectUrl();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start Google sign-in';
    return { success: false, error: message };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message.includes('invalid_client')
        ? 'Google sign-in is not set up correctly in Supabase. Check Client ID and Secret under Authentication → Providers → Google.'
        : error.message,
    };
  }
  if (!data.url) return { success: false, error: 'Could not start Google sign-in' };

  // Use the system browser so Google can reuse saved accounts (Chrome/Edge logins).
  if (window.electron?.openExternalUrl) {
    await window.electron.openExternalUrl(data.url);
  } else if (window.electron?.openOAuthSignIn) {
    const opened = await window.electron.openOAuthSignIn(data.url);
    if (!opened.success) {
      return { success: false, error: opened.error || 'Could not open sign-in window' };
    }
  } else {
    window.location.href = data.url;
  }

  return { success: true, url: data.url };
}

export async function handleOAuthCallback(accessToken: string, refreshToken?: string): Promise<AuthSessionResult> {
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || '',
  });

  if (error || !data.session) {
    return { success: false, error: error?.message || 'Failed to establish session' };
  }

  return {
    success: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user?.id,
    email: data.user?.email || '',
    needsOnboarding: true,
  };
}
