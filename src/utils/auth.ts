// Authentication utilities with Supabase integration

import { supabase } from './supabase';

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

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  requiresEmailVerification?: boolean;
}

// Validate email format
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Helper function to manually create profile
const createProfileManually = async (userId: string, name: string, email: string) => {
  try {
    console.log('🔄 Creating profile manually for user:', userId);
    
    // Call the custom function to create a profile
    const { data, error } = await supabase.rpc('create_user_profile', {
      user_id: userId,
      user_name: name,
      user_email: email
    });
    
    if (error) {
      console.warn('Function call failed, trying direct insert:', error);
      
      // Fallback to direct insert
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: name,
          email: email
        });
      
      if (insertError) {
        console.error('Direct profile insert failed:', insertError);
        throw insertError;
      }
    }
    
    console.log('✅ Profile created manually');
    return true;
  } catch (error) {
    console.error('❌ Manual profile creation failed:', error);
    return false;
  }
};

// Login function with Supabase
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const { email, password } = credentials;

    // Validate input
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }

    if (!validateEmail(email)) {
      return {
        success: false,
        error: 'Please enter a valid email address'
      };
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(email);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.'
      };
    }

    console.log('🔄 Attempting login for:', email);
    
    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password
    });
    
    if (authError) {
      console.error('Supabase auth error:', authError);
      recordLoginAttempt(email, false);
      
      // Provide specific error messages
      if (authError.message.includes('Invalid login credentials')) {
        return {
          success: false,
          error: 'Invalid email or password. Please check your credentials and try again.'
        };
      }
      
      return {
        success: false,
        error: authError.message || 'Login failed. Please check your credentials.'
      };
    }

    if (!authData.user) {
      recordLoginAttempt(email, false);
      return {
        success: false,
        error: 'Login failed - no user data'
      };
    }

    // 🔒 SECURITY: Check if email is verified
    if (!authData.user.email_confirmed_at) {
      recordLoginAttempt(email, false);
      return {
        success: false,
        error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        requiresEmailVerification: true
      };
    }

    // Record successful login
    recordLoginAttempt(email, true);
    
    console.log('✅ Authentication successful, fetching profile...');
    
    // Try to get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    
    // If profile doesn't exist, create it manually
    if (profileError) {
      console.warn('Profile fetch error:', profileError);
      console.log('Attempting to create profile manually...');
      
      // Create profile manually
      const success = await createProfileManually(
        authData.user.id, 
        authData.user.user_metadata.name || email.split('@')[0], 
        email
      );
      
      if (!success) {
        console.warn('Failed to create profile, continuing with basic user data');
      }
    }
    
    // Get user's shop if they have one
    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', authData.user.id)
      .limit(1);
    
    const shopId = shops && shops.length > 0 ? shops[0].id : undefined;
    
    // Create user object
    const user: User = {
      id: authData.user.id,
      email: authData.user.email || '',
      name: profile?.name || authData.user.user_metadata.name || email.split('@')[0],
      shopId: shopId,
      role: 'owner',
      isActive: true,
      createdAt: authData.user.created_at || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      emailVerified: authData.user.email_confirmed_at ? true : false
    };
    
    // Store session data
    localStorage.setItem('user-session', JSON.stringify(user));
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('auth-token', authData.session?.access_token || '');
    
    if (shopId) {
      localStorage.setItem('shop-id', shopId);
    }
    
    console.log('✅ Login completed successfully');
    
    return {
      success: true,
      user: user,
      token: authData.session?.access_token
    };
    
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    };
  }
};

// Signup function with Supabase
export const signup = async (signupData: SignupData): Promise<AuthResponse> => {
  try {
    const { name, email, password, confirmPassword, shopName, phone, address } = signupData;
    
    // Validate input
    if (!name || !email || !password || !confirmPassword || !shopName || !phone || !address) {
      return {
        success: false,
        error: 'All fields are required'
      };
    }
    
    if (!validateEmail(email)) {
      return {
        success: false,
        error: 'Please enter a valid email address'
      };
    }
    
    if (password !== confirmPassword) {
      return {
        success: false,
        error: 'Passwords do not match'
      };
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. ')
      };
    }
    
    // Validate phone number (minimum 10 digits)
    const phoneDigits = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^[\+]?[1-9][\d]{9,15}$/;
    if (!phoneRegex.test(phoneDigits)) {
      return {
        success: false,
        error: 'Please enter a valid phone number (minimum 10 digits)'
      };
    }

    console.log('🔄 Checking for duplicate email/phone...');

    // Check if email already exists in shops table
    const { data: existingEmailShop } = await supabase
      .from('shops')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingEmailShop) {
      return {
        success: false,
        error: 'An account with this email address already exists. Please login instead.'
      };
    }

    // Check if phone already exists in shops table
    const { data: existingPhoneShop } = await supabase
      .from('shops')
      .select('id')
      .eq('phone', phone.trim())
      .maybeSingle();

    if (existingPhoneShop) {
      return {
        success: false,
        error: 'An account with this phone number already exists. Please use a different phone number.'
      };
    }

    console.log('🔄 Starting Supabase signup process...');
    
    // Sign up with Supabase - Email verification is required
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
      options: {
        data: {
          name: name.trim()
        },
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    
    if (authError) {
      console.error('❌ Supabase signup error:', authError);
      
      // Provide specific error messages
      if (authError.message.includes('already registered')) {
        return {
          success: false,
          error: 'This email address is already registered. Please sign in instead.'
        };
      }
      
      return {
        success: false,
        error: authError.message || 'Signup failed. Please try again.'
      };
    }
    
    if (!authData.user) {
      return {
        success: false,
        error: 'Signup failed - no user data. Please try again.'
      };
    }
    
    console.log('✅ User created in Supabase:', authData.user.id);
    
    // Check if email confirmation is required
    if (!authData.session) {
      console.log('📧 Email verification required');
      return {
        success: true,
        requiresEmailVerification: true,
        user: {
          id: authData.user.id,
          email: authData.user.email || '',
          name: name.trim(),
          role: 'owner',
          isActive: false,
          createdAt: authData.user.created_at || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          emailVerified: false
        },
        error: 'Please check your email to verify your account before signing in.'
      };
    }
    
    console.log('✅ Email auto-verified or confirmation not required');
    
    // Wait for trigger to potentially create profile
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create profile manually to ensure it exists
    await createProfileManually(authData.user.id, name.trim(), email.toLowerCase());
    
    // Create shop in database
    console.log('🏪 Creating shop in database...');
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert({
        name: shopName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.toLowerCase(),
        owner_id: authData.user.id,
        is_active: true
      })
      .select()
      .single();
    
    if (shopError) {
      console.error('❌ Shop creation error:', shopError);
      return {
        success: false,
        error: 'Failed to create shop: ' + shopError.message
      };
    }
    
    console.log('✅ Shop created successfully:', shop.id);
    
    // Save shop information locally
    const shopInfo = {
      name: shopName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.toLowerCase(),
      googleMapsLink: ''
    };
    
    localStorage.setItem('shop-info', JSON.stringify(shopInfo));
    localStorage.setItem('shop-id', shop.id);
    
    // Create user object
    const user: User = {
      id: authData.user.id,
      email: authData.user.email || '',
      name: name.trim(),
      shopId: shop.id,
      role: 'owner',
      isActive: true,
      createdAt: authData.user.created_at || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      emailVerified: authData.user.email_confirmed_at ? true : false
    };
    
    // Store session data
    localStorage.setItem('user-session', JSON.stringify(user));
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('auth-token', authData.session?.access_token || '');
    
    console.log('🎉 Signup completed successfully!');
    
    return {
      success: true,
      user: user,
      token: authData.session?.access_token
    };
    
  } catch (error) {
    console.error('❌ Signup error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    };
  }
};

// Logout function
export const logout = async (): Promise<void> => {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear local storage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user-session');
    localStorage.removeItem('auth-token');
    localStorage.removeItem('shop-id');
    
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// Validate session
export const validateSession = (): { isValid: boolean; user?: User } => {
  try {
    const authStatus = localStorage.getItem('isAuthenticated');
    const userSession = localStorage.getItem('user-session');
    const token = localStorage.getItem('auth-token');
    
    if (authStatus !== 'true' || !userSession || !token) {
      return { isValid: false };
    }
    
    const user = JSON.parse(userSession);
    
    return { isValid: true, user };
    
  } catch (error) {
    console.error('Session validation error:', error);
    logout();
    return { isValid: false };
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  const validation = validateSession();
  return validation.isValid ? validation.user || null : null;
};

// Change password
export const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors.join('. ') };
    }
    
    // Update password in Supabase
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

// Reset password request
export const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string; message?: string }> => {
  try {
    if (!email || !validateEmail(email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      return { success: false, error: 'Failed to send reset email. Please try again.' };
    }

    return { success: true, message: 'Password reset instructions have been sent to your email address.' };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

// Resend email verification
export const resendVerificationEmail = async (email: string): Promise<{ success: boolean; error?: string; message?: string }> => {
  try {
    if (!email || !validateEmail(email)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    console.log('🔄 Resending verification email to:', email);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      console.error('❌ Error resending verification:', error);
      return { success: false, error: 'Failed to resend verification email. Please try again or contact support.' };
    }

    console.log('✅ Verification email resent successfully');
    return { success: true, message: 'Verification email has been sent! Please check your inbox and spam folder.' };
  } catch (error) {
    console.error('❌ Unexpected error resending verification:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

// Rate limiting
const checkRateLimit = async (email: string): Promise<{ allowed: boolean }> => {
  const key = `login_attempts_${email.toLowerCase()}`;
  const data = localStorage.getItem(key);
  if (!data) return { allowed: true };

  const { attempts, firstAttemptTime } = JSON.parse(data);
  const now = Date.now();
  if (now - firstAttemptTime > 15 * 60 * 1000) {
    localStorage.removeItem(key);
    return { allowed: true };
  }
  if (attempts >= 5) return { allowed: false };
  return { allowed: true };
};

const recordLoginAttempt = (email: string, success: boolean): void => {
  const key = `login_attempts_${email.toLowerCase()}`;
  if (success) {
    localStorage.removeItem(key);
    return;
  }
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify({ attempts: 1, firstAttemptTime: Date.now() }));
  } else {
    const { attempts, firstAttemptTime } = JSON.parse(data);
    localStorage.setItem(key, JSON.stringify({ attempts: attempts + 1, firstAttemptTime }));
  }
};

// Initialize auth system
export const initializeAuth = (): { unsubscribe: () => void } => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session);
    if (event === 'SIGNED_OUT') {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user-session');
      localStorage.removeItem('auth-token');
      localStorage.removeItem('shop-id');
    }
  });
  
  return {
    unsubscribe: () => subscription.unsubscribe()
  };
};