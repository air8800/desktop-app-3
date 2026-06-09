// Partner authentication with Google + email OTP and onboarding

import { DEFAULT_SHOP_TIMING } from './defaultShopHours';
import {
  supabase,
  shopRowToLocalInfo,
  businessDetailsFromDb,
  shopTimingFromDb,
} from './supabase';
import {
  requestEmailCode as apiRequestCode,
  verifyEmailCode as apiVerifyCode,
  notifySignupComplete,
  startGoogleAuth,
  type PartnerSignupPayload,
} from './partnerAuthApi';
import { getStoredSession, setStoredSession, clearStoredSession } from './sessionStorage';

export interface User {
  id: string;
  email: string;
  name: string;
  shopId?: string;
  role: 'owner' | 'admin' | 'staff';
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
  emailVerified: boolean;
}

export interface OnboardingData {
  name: string;
  phone: string;
  shopName: string;
  businessType: string;
  businessTypeOther?: string;
  address: string;
  googleMapsLink: string;
  latitude: string;
  longitude: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  needsOnboarding?: boolean;
}

export const BUSINESS_TYPES = [
  { value: 'xerox_shop', label: 'Xerox shop' },
  { value: 'print_center', label: 'Print center' },
  { value: 'cyber_cafe', label: 'Cyber café' },
  { value: 'stationery_print', label: 'Stationery + print' },
  { value: 'other', label: 'Other' },
] as const;

export const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const validatePhone = (phone: string): boolean => {
  const digits = phone.replace(/[\s\-()]/g, '');
  return /^[+]?[1-9][\d]{9,15}$/.test(digits);
};

async function applySupabaseSession(accessToken: string, refreshToken?: string) {
  if (!accessToken) return;

  let refresh = refreshToken;
  if (!refresh) {
    const stored = await getStoredSession();
    refresh = stored?.refreshToken;
  }

  if (!refresh) {
    console.warn('No refresh token available — Supabase writes may fail');
    return;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refresh,
  });

  if (error) {
    console.error('Failed to apply Supabase session:', error.message);
  }
}

function parseShopCoordinate(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

async function resolveUserAfterAuth(
  userId: string,
  email: string,
  userMetadata?: Record<string, unknown>
): Promise<{ user: User; needsOnboarding: boolean }> {
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, address, phone')
    .eq('owner_id', userId)
    .limit(1);

  const shop = shops?.[0];
  const needsOnboarding = !shop ? true : !shop.name || !shop.address || !shop.phone;

  let name =
    (typeof userMetadata?.full_name === 'string' && userMetadata.full_name) ||
    (typeof userMetadata?.name === 'string' && userMetadata.name) ||
    '';

  if (!name) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle();
    name = profile?.name || email.split('@')[0];
  }

  const user: User = {
    id: userId,
    email,
    name,
    shopId: shop?.id,
    role: 'owner',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    emailVerified: true,
  };

  return { user, needsOnboarding };
}

export async function checkNeedsOnboarding(userId: string): Promise<boolean> {
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, address, phone')
    .eq('owner_id', userId)
    .limit(1);

  if (!shops?.length) return true;
  const shop = shops[0];
  return !shop.name || !shop.address || !shop.phone;
}

export async function requestEmailCode(email: string): Promise<{ success: boolean; error?: string }> {
  if (!email || !validateEmail(email)) {
    return { success: false, error: 'Please enter a valid email address' };
  }
  return apiRequestCode(email);
}

export async function verifyEmailCode(
  email: string,
  code: string
): Promise<AuthResponse> {
  if (!code || code.length < 6) {
    return { success: false, error: 'Please enter the 6-digit code' };
  }

  const result = await apiVerifyCode(email, code);
  if (!result.success || !result.accessToken || !result.userId) {
    return { success: false, error: result.error || 'Verification failed' };
  }

  await applySupabaseSession(result.accessToken, result.refreshToken);
  const { user, needsOnboarding } = await resolveUserAfterAuth(
    result.userId,
    result.email || email
  );

  await setStoredSession({
    user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    shopId: user.shopId,
  });

  return {
    success: true,
    user,
    token: result.accessToken,
    needsOnboarding,
  };
}

export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  return startGoogleAuth();
}

export async function completeOAuthFromTokens(
  accessToken: string,
  refreshToken?: string
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || '',
  });

  if (error || !data.session || !data.user?.id) {
    return { success: false, error: error?.message || 'Google sign-in failed' };
  }

  const { user, needsOnboarding } = await resolveUserAfterAuth(
    data.user.id,
    data.user.email || '',
    data.user.user_metadata as Record<string, unknown>
  );

  await setStoredSession({
    user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    shopId: user.shopId,
  });

  return {
    success: true,
    user,
    token: data.session.access_token,
    needsOnboarding,
  };
}

export async function completePartnerOnboarding(
  data: OnboardingData,
  accessToken: string,
  userId: string,
  email: string
): Promise<{ success: boolean; shopId?: string; user?: User; error?: string }> {
  const businessDetails = {
    ownerName: data.name.trim(),
    businessType: data.businessType,
    ...(data.businessType === 'other' && data.businessTypeOther
      ? { businessTypeOther: data.businessTypeOther.trim() }
      : {}),
  };

  const storedSession = await getStoredSession();
  await applySupabaseSession(accessToken, storedSession?.refreshToken);

  const lat = parseShopCoordinate(data.latitude);
  const lng = parseShopCoordinate(data.longitude);

  if (lat == null || lng == null) {
    return { success: false, error: 'Valid latitude and longitude are required.' };
  }

  // Upsert profile
  await supabase.from('profiles').upsert({
    id: userId,
    name: data.name.trim(),
    email: email.toLowerCase(),
    updated_at: new Date().toISOString(),
  });

  const { data: existingShops } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', userId)
    .limit(1);

  const shopRecord = {
    name: data.shopName.trim(),
    address: data.address.trim(),
    phone: data.phone.trim(),
    email: email.toLowerCase(),
    owner_id: userId,
    google_maps_link: data.googleMapsLink.trim() || null,
    latitude: lat,
    longitude: lng,
    business_details: businessDetails,
    is_active: true,
    operating_hours: DEFAULT_SHOP_TIMING,
    desktop_live: true,
    desktop_live_at: new Date().toISOString(),
  };

  let shopId: string;

  if (existingShops?.length) {
    const { data: updated, error } = await supabase
      .from('shops')
      .update(shopRecord)
      .eq('id', existingShops[0].id)
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    shopId = updated.id;
  } else {
    const { data: created, error } = await supabase
      .from('shops')
      .insert(shopRecord)
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    shopId = created.id;
  }

  const { data: savedShop, error: verifyError } = await supabase
    .from('shops')
    .select(
      'id, name, address, phone, email, google_maps_link, latitude, longitude, business_details, operating_hours'
    )
    .eq('id', shopId)
    .single();

  const savedBusiness = businessDetailsFromDb(savedShop?.business_details);
  const signupSaved =
    !verifyError &&
    savedShop?.name?.trim() &&
    savedShop?.address?.trim() &&
    savedShop?.phone?.trim() &&
    savedShop.latitude != null &&
    savedShop.longitude != null &&
    savedBusiness.businessType &&
    savedBusiness.ownerName;

  if (!signupSaved) {
    return {
      success: false,
      error:
        verifyError?.message ||
        'Shop details could not be saved. Check your connection and try again.',
    };
  }

  const shopInfo = shopRowToLocalInfo(savedShop);
  const cachedBusinessDetails = businessDetailsFromDb(savedShop.business_details);
  const cachedShopTiming = shopTimingFromDb(savedShop.operating_hours);

  localStorage.setItem('shop-info', JSON.stringify(shopInfo));
  localStorage.setItem('shop-id', shopId);
  localStorage.setItem('business-details', JSON.stringify(cachedBusinessDetails));
  localStorage.setItem('shop-timing', JSON.stringify(cachedShopTiming));

  const payload: PartnerSignupPayload = {
    name: data.name.trim(),
    phone: data.phone.trim(),
    shopName: data.shopName.trim(),
    businessType: data.businessType,
    businessTypeOther: data.businessTypeOther,
    address: data.address.trim(),
    googleMapsLink: data.googleMapsLink.trim(),
    latitude: lat,
    longitude: lng,
  };
  await notifySignupComplete(accessToken, payload);

  const user: User = {
    id: userId,
    email,
    name: data.name.trim(),
    shopId,
    role: 'owner',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    emailVerified: true,
  };

  const session = await getStoredSession();
  await setStoredSession({
    user,
    accessToken: session?.accessToken || accessToken,
    refreshToken: session?.refreshToken,
    shopId,
  });

  return { success: true, shopId, user };
}

export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  await clearStoredSession();
}

export async function validateSession(): Promise<{ isValid: boolean; user?: User; needsOnboarding?: boolean }> {
  try {
    const stored = await getStoredSession();
    if (!stored?.accessToken || !stored.user) {
      return { isValid: false };
    }

    await applySupabaseSession(stored.accessToken, stored.refreshToken);

    const needsOnboarding = await checkNeedsOnboarding(stored.user.id);
    const user = { ...stored.user, shopId: stored.shopId || stored.user.shopId };

    return { isValid: true, user, needsOnboarding };
  } catch {
    await clearStoredSession();
    return { isValid: false };
  }
}

export const getCurrentUser = async (): Promise<User | null> => {
  const v = await validateSession();
  return v.isValid ? v.user || null : null;
};

export function initializeAuth(): { unsubscribe: () => void } {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearStoredSession();
    }
  });

  return { unsubscribe: () => subscription.unsubscribe() };
}

// Legacy exports kept for any remaining imports
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  shopName: string;
  phone: string;
  address: string;
}

export const login = async (): Promise<AuthResponse> => ({
  success: false,
  error: 'Please sign in with Google or email verification code.',
});

export const signup = async (): Promise<AuthResponse> => ({
  success: false,
  error: 'Please use Google or email verification to create an account.',
});

export const requestPasswordReset = async (): Promise<{ success: boolean; error?: string; message?: string }> => ({
  success: false,
  error: 'Password reset is not available. Sign in with Google or email code.',
});

export const resendVerificationEmail = async (email: string) => requestEmailCode(email);

export const validatePassword = (): { isValid: boolean; errors: string[] } => ({
  isValid: false,
  errors: ['Passwords are not used. Sign in with Google or email code.'],
});

export const changePassword = async (): Promise<{ success: boolean; error?: string }> => ({
  success: false,
  error: 'Password change is not available for this account type.',
});
