import React from 'react';
import { Mail } from 'lucide-react';
import PrintGetLogo from '../PrintGetLogo';

interface AuthWelcomeProps {
  onGoogle: () => void;
  onEmail: () => void;
  isLoading: boolean;
  error?: string;
}

const AuthWelcome: React.FC<AuthWelcomeProps> = ({ onGoogle, onEmail, isLoading, error }) => (
  <div className="login-form-stagger space-y-5">
    <div className="text-center login-form-stagger__item">
      <div className="flex justify-center mb-3">
        <PrintGetLogo size="lg" />
      </div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Welcome back</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Sign in or create your shop account
      </p>
    </div>

    {isLoading && (
      <div className="login-form-stagger__item text-center space-y-2">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Complete sign-in in your browser — PrintGet will continue here when you&apos;re done.
        </p>
      </div>
    )}

    {error && (
      <div className="login-form-stagger__item bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    )}

    <button
      type="button"
      onClick={onGoogle}
      disabled={isLoading}
      className="login-form-stagger__item login-auth-btn-google"
    >
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Continue with Google
    </button>

    <div className="login-form-stagger__item login-auth-divider">
      <span>or</span>
    </div>

    <button
      type="button"
      onClick={onEmail}
      disabled={isLoading}
      className="login-form-stagger__item login-auth-btn-email"
    >
      <Mail className="h-5 w-5 shrink-0" aria-hidden />
      Continue with Email
    </button>

    <p className="login-form-stagger__item text-xs text-center text-slate-500 dark:text-slate-400">
      Verification codes are sent from hello@printget.in
    </p>
  </div>
);

export default AuthWelcome;
