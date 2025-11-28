import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, Building, Phone, MapPin, CheckCircle, AlertTriangle, ArrowRight, UserPlus, Printer, Shield, Zap, Globe, Monitor, Layers, Sparkles, KeyRound, RefreshCw } from 'lucide-react';
import { login, signup, validateEmail, validatePassword, requestPasswordReset, resendVerificationEmail, type LoginCredentials, type SignupData } from '../utils/auth';

interface LoginProps {
  onLogin: (userData: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  const [loginData, setLoginData] = useState<LoginCredentials>({
    email: '',
    password: ''
  });

  const [signupData, setSignupData] = useState<SignupData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    shopName: '',
    phone: '',
    address: ''
  });

  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    feedback: string[];
  }>({ score: 0, feedback: [] });

  // Real-time password strength validation
  const checkPasswordStrength = (password: string) => {
    const validation = validatePassword(password);
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score += 1;
    else feedback.push('At least 8 characters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('One uppercase letter');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('One lowercase letter');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('One number');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('One special character');

    setPasswordStrength({ score, feedback });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSuccessMessage('');
    
    console.log('Login form submitted');
    
    // Client-side validation
    const validationErrors: string[] = [];
    
    if (!loginData.email.trim()) {
      validationErrors.push('Email is required');
    } else if (!validateEmail(loginData.email)) {
      validationErrors.push('Please enter a valid email address');
    }
    
    if (!loginData.password.trim()) {
      validationErrors.push('Password is required');
    }
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Starting secure login process...');
      
      const result = await login(loginData);
      
      // Handle email verification requirement
      if (result.requiresEmailVerification) {
        console.log('Email verification required for:', loginData.email);
        setVerificationEmail(loginData.email);
        setErrors([result.error || 'Please verify your email before logging in.']);
        setShowEmailVerification(true);
        return;
      }
      
      if (result.success && result.user && result.token) {
        console.log('Login successful:', result.user);
        
        setSuccessMessage('Login successful! Welcome back!');
        
        // Store authentication data securely
        const userData = {
          ...result.user,
          token: result.token,
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        // Store auth token separately for security
        localStorage.setItem('auth-token', result.token);
        
        // Call the login handler
        setTimeout(() => {
          onLogin(userData);
        }, 1000);
        
      } else {
        setErrors([result.error || 'Login failed. Please try again.']);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setErrors(['An unexpected error occurred. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setErrors([]);
    setSuccessMessage('');
    setIsLoading(true);
    
    try {
      const result = await resendVerificationEmail(verificationEmail);
      
      if (result.success) {
        setSuccessMessage(result.message || 'Verification email sent!');
      } else {
        setErrors([result.error || 'Failed to resend verification email']);
      }
    } catch (error) {
      setErrors(['An unexpected error occurred']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSuccessMessage('');
    
    console.log('Signup form submitted');
    
    // Client-side validation
    const validationErrors: string[] = [];
    
    if (!signupData.name.trim()) {
      validationErrors.push('Full name is required');
    }
    
    if (!signupData.email.trim()) {
      validationErrors.push('Email is required');
    } else if (!validateEmail(signupData.email)) {
      validationErrors.push('Please enter a valid email address');
    }
    
    if (!signupData.password.trim()) {
      validationErrors.push('Password is required');
    }
    
    if (signupData.password !== signupData.confirmPassword) {
      validationErrors.push('Passwords do not match');
    }
    
    if (!signupData.shopName.trim()) {
      validationErrors.push('Shop name is required');
    }
    
    if (!signupData.phone.trim()) {
      validationErrors.push('Phone number is required');
    }
    
    if (!signupData.address.trim()) {
      validationErrors.push('Shop address is required');
    }
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Starting secure signup process...');
      
      const result = await signup(signupData);
      
      // Handle email verification requirement
      if (result.requiresEmailVerification) {
        console.log('Email verification required for:', signupData.email);
        setVerificationEmail(signupData.email);
        setSuccessMessage('Account created! Please check your email to verify your account.');
        setShowEmailVerification(true);
        return;
      }
      
      if (result.success && result.user && result.token) {
        console.log('Signup successful:', result.user);
        
        setSuccessMessage('Account created successfully! Welcome to Xerox Manager!');
        
        // Store authentication data securely
        const userData = {
          ...result.user,
          token: result.token,
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        // Store auth token separately for security
        localStorage.setItem('auth-token', result.token);
        
        // Call the login handler
        setTimeout(() => {
          onLogin(userData);
        }, 1000);
        
      } else {
        setErrors([result.error || 'Signup failed. Please try again.']);
      }
      
    } catch (error) {
      console.error('Signup error:', error);
      setErrors(['An unexpected error occurred. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSuccessMessage('');
    if (!forgotPasswordEmail.trim()) {
      setErrors(['Please enter your email address']);
      return;
    }
    if (!validateEmail(forgotPasswordEmail)) {
      setErrors(['Please enter a valid email address']);
      return;
    }
    setIsLoading(true);
    try {
      const result = await requestPasswordReset(forgotPasswordEmail);
      if (result.success) {
        setSuccessMessage(result.message || 'Password reset email sent!');
        setForgotPasswordEmail('');
        setTimeout(() => {
          setShowForgotPassword(false);
          setSuccessMessage('');
        }, 3000);
      } else {
        setErrors([result.error || 'Failed to send reset email']);
      }
    } catch (error) {
      setErrors(['An unexpected error occurred']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginInputChange = (field: keyof LoginCredentials, value: string) => {
    setLoginData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
  };

  const handleSignupInputChange = (field: keyof SignupData, value: string) => {
    setSignupData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
    
    // Real-time password strength check
    if (field === 'password') {
      checkPasswordStrength(value);
    }
  };

  const getPasswordStrengthColor = (score: number) => {
    if (score <= 1) return 'bg-red-500';
    if (score <= 2) return 'bg-orange-500';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = (score: number) => {
    if (score <= 1) return 'Very Weak';
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Fair';
    if (score <= 4) return 'Good';
    return 'Strong';
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* CLEAN: Professional Background without Grid Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950">
        {/* Subtle Floating Elements Only */}
        <div className="absolute top-20 left-20 w-40 h-40 bg-gradient-to-br from-blue-200/20 to-indigo-300/20 dark:from-blue-800/15 dark:to-indigo-900/15 rounded-3xl rotate-12 blur-sm"></div>
        <div className="absolute top-32 right-24 w-32 h-32 bg-gradient-to-br from-blue-200/15 to-indigo-300/15 dark:from-blue-800/10 dark:to-indigo-900/10 rounded-2xl -rotate-12 blur-sm"></div>
        <div className="absolute bottom-40 left-40 w-48 h-48 bg-gradient-to-br from-indigo-200/20 to-blue-300/20 dark:from-indigo-800/15 dark:to-blue-900/15 rounded-full blur-sm"></div>
        <div className="absolute bottom-20 right-20 w-36 h-36 bg-gradient-to-br from-blue-200/15 to-indigo-300/15 dark:from-blue-800/10 dark:to-indigo-900/10 rounded-3xl rotate-45 blur-sm"></div>
        
        {/* Additional Clean Accent Elements */}
        <div className="absolute top-1/2 left-10 w-24 h-24 bg-gradient-to-br from-blue-200/10 to-indigo-300/10 dark:from-blue-800/8 dark:to-indigo-900/8 rounded-xl rotate-45 blur-sm"></div>
        <div className="absolute top-1/3 right-10 w-28 h-28 bg-gradient-to-br from-indigo-200/10 to-blue-300/10 dark:from-indigo-800/8 dark:to-blue-900/8 rounded-2xl -rotate-30 blur-sm"></div>
      </div>

      {/* PROFESSIONAL: Two-Column Layout */}
      <div className="relative z-10 min-h-screen flex">
        {/* LEFT SIDE: Professional Branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative">
          {/* Company Branding */}
          <div className="text-center mb-12">
            <div className="relative mb-8">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center shadow-2xl mx-auto mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                <Printer className="h-16 w-16 text-white relative z-10" />
              </div>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent mb-4">
              Xerox Manager
            </h1>
            <p className="text-2xl text-slate-600 dark:text-slate-300 mb-2 font-medium">
              Professional Print Shop Management
            </p>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              Streamline operations, maximize efficiency
            </p>
          </div>

          {/* PROFESSIONAL: Enhanced Feature Grid */}
          <div className="grid grid-cols-2 gap-6 max-w-lg">
            <div className="text-center p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Monitor className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">Real-time Dashboard</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Live order tracking & analytics</p>
            </div>

            <div className="text-center p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">Enterprise Security</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Bank-level data protection</p>
            </div>

            <div className="text-center p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">Smart Automation</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">AI-powered workflow optimization</p>
            </div>

            <div className="text-center p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">Digital Presence</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">QR code & online ordering</p>
            </div>
          </div>

          {/* Professional Stats with Enhanced Design */}
          <div className="mt-12 grid grid-cols-3 gap-8 text-center">
            <div className="p-4 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/20">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">500+</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Active Shops</div>
            </div>
            <div className="p-4 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/20">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">99.9%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Uptime</div>
            </div>
            <div className="p-4 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-700/20">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">24/7</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Support</div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Authentication Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center shadow-2xl mx-auto mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                <Printer className="h-10 w-10 text-white relative z-10" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent mb-2">
                Xerox Manager
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                {isLogin ? 'Welcome back to your dashboard' : 'Start your digital transformation'}
              </p>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl p-4 mb-6 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" />
                <span className="text-green-800 dark:text-green-300 font-medium">{successMessage}</span>
              </div>
            )}

            {/* Error Messages */}
            {errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                  <div className="text-red-800 dark:text-red-300">
                    {errors.map((error, index) => (
                      <div key={index} className="font-medium">{error}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PROFESSIONAL: Form Container */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 dark:border-gray-700/20">
              {/* Tab Switcher - Hide when showing verification or forgot password */}
              {!showEmailVerification && !showForgotPassword && (
                <div className="flex mb-8 bg-slate-100/80 dark:bg-slate-700/80 rounded-2xl p-2 backdrop-blur-sm">
                  <button
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                      isLogin
                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-lg'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <User className="h-5 w-5 inline mr-2" />
                    Sign In
                  </button>
                  <button
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                      !isLogin
                        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-lg'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <UserPlus className="h-5 w-5 inline mr-2" />
                    Create Account
                  </button>
                </div>
              )}

              {/* Login Form */}
              {isLogin ? (
                showEmailVerification ? (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <Mail className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Verify Your Email</h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4">
                        We've sent a verification link to
                      </p>
                      <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {verificationEmail}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300">
                      <p className="font-semibold mb-2">Next steps:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Check your email inbox for the verification link</li>
                        <li>Click the link to verify your account</li>
                        <li>Return to this page and sign in</li>
                      </ol>
                      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                        💡 Don't see the email? Check your spam folder
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isLoading}
                      className={`w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-4 rounded-xl font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-5 w-5 mr-3" />
                          Resend Verification Email
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmailVerification(false);
                        setErrors([]);
                        setSuccessMessage('');
                      }}
                      className="w-full text-blue-600 dark:text-blue-400 hover:underline font-semibold transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                ) : showForgotPassword ? (
                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div className="text-center mb-6">
                      <KeyRound className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Reset Password</h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        Enter your email and we'll send you reset instructions
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        <Mail className="h-4 w-4 inline mr-2" />
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-4 text-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-lg focus:shadow-xl cursor-visible"
                        autoComplete="email"
                        spellCheck="false"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-xl py-4 rounded-xl font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Mail className="h-6 w-6 mr-3" />
                          Send Reset Link
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setErrors([]);
                        setSuccessMessage('');
                      }}
                      className="w-full text-blue-600 dark:text-blue-400 hover:underline font-semibold transition-colors"
                    >
                      Back to Login
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          <Mail className="h-4 w-4 inline mr-2" />
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={loginData.email}
                          onChange={(e) => handleLoginInputChange('email', e.target.value)}
                          placeholder="your@email.com"
                          className="w-full px-4 py-4 text-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-lg focus:shadow-xl cursor-visible"
                          autoComplete="email"
                          spellCheck="false"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <Lock className="h-4 w-4 inline mr-2" />
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold transition-colors"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={loginData.password}
                            onChange={(e) => handleLoginInputChange('password', e.target.value)}
                            placeholder="Enter your password"
                            className="w-full px-4 py-4 text-lg pr-12 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-lg focus:shadow-xl cursor-visible"
                            autoComplete="current-password"
                            spellCheck="false"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-xl py-4 rounded-xl font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                          Signing In...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <User className="h-6 w-6 mr-3" />
                          Sign In to Dashboard
                          <ArrowRight className="h-6 w-6 ml-3" />
                        </div>
                      )}
                    </button>
                  </form>
                )
              ) : (
                /* Signup Form */
                <form onSubmit={handleSignup} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Personal Information
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={signupData.name}
                        onChange={(e) => handleSignupInputChange('name', e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-visible"
                        autoComplete="name"
                        spellCheck="false"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={signupData.email}
                        onChange={(e) => handleSignupInputChange('email', e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-visible"
                        autoComplete="email"
                        spellCheck="false"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={signupData.password}
                            onChange={(e) => handleSignupInputChange('password', e.target.value)}
                            placeholder="Create password"
                            className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-visible"
                            autoComplete="new-password"
                            spellCheck="false"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        
                        {/* Password Strength Indicator */}
                        {signupData.password && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Strength: {getPasswordStrengthText(passwordStrength.score)}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {passwordStrength.score}/5
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength.score)}`}
                                style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                              ></div>
                            </div>
                            {passwordStrength.feedback.length > 0 && (
                              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                Missing: {passwordStrength.feedback.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={signupData.confirmPassword}
                            onChange={(e) => handleSignupInputChange('confirmPassword', e.target.value)}
                            placeholder="Confirm password"
                            className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-visible"
                            autoComplete="new-password"
                            spellCheck="false"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        
                        {/* Password Match Indicator */}
                        {signupData.confirmPassword && (
                          <div className="mt-2 flex items-center">
                            {signupData.password === signupData.confirmPassword ? (
                              <div className="flex items-center text-green-600 dark:text-green-400">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                <span className="text-sm">Passwords match</span>
                              </div>
                            ) : (
                              <div className="flex items-center text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                <span className="text-sm">Passwords don't match</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Shop Information */}
                  <div className="space-y-4 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center">
                      <Building className="h-5 w-5 mr-2" />
                      Shop Information
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Shop Name
                      </label>
                      <input
                        type="text"
                        value={signupData.shopName}
                        onChange={(e) => handleSignupInputChange('shopName', e.target.value)}
                        placeholder="Your Xerox Shop Name"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-visible"
                        autoComplete="organization"
                        spellCheck="false"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={signupData.phone}
                        onChange={(e) => handleSignupInputChange('phone', e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-visible"
                        autoComplete="tel"
                        spellCheck="false"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Shop Address
                      </label>
                      <textarea
                        rows={3}
                        value={signupData.address}
                        onChange={(e) => handleSignupInputChange('address', e.target.value)}
                        placeholder="Your shop's full address"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none cursor-visible"
                        autoComplete="street-address"
                        spellCheck="false"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || passwordStrength.score < 5}
                    className={`w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-xl py-4 rounded-xl font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 ${(isLoading || passwordStrength.score < 5) ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                        Creating Account...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <UserPlus className="h-6 w-6 mr-3" />
                        Create Account & Start
                        <ArrowRight className="h-6 w-6 ml-3" />
                      </div>
                    )}
                  </button>
                </form>
              )}

              {/* Footer */}
              <div className="mt-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold transition-colors"
                  >
                    {isLogin ? 'Create one here' : 'Sign in here'}
                  </button>
                </p>
              </div>
            </div>

            {/* Mobile Features */}
            <div className="lg:hidden mt-8 grid grid-cols-2 gap-4 text-center">
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-lg">
                <Zap className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-white">Real-time Orders</p>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-lg">
                <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-white">Secure Platform</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;