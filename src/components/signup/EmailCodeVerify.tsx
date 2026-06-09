import React, { useState } from 'react';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import { validateEmail } from '../../utils/auth';

interface EmailCodeVerifyProps {
  onBack: () => void;
  onCodeSent: (email: string) => void;
  onVerify: (email: string, code: string) => void;
  isLoading: boolean;
  error?: string;
  initialEmail?: string;
  codeSent: boolean;
}

const EmailCodeVerify: React.FC<EmailCodeVerifyProps> = ({
  onBack,
  onCodeSent,
  onVerify,
  isLoading,
  error,
  initialEmail = '',
  codeSent,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;
    onCodeSent(email.trim().toLowerCase());
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify(email.trim().toLowerCase(), code.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </button>

      <div className="text-center">
        <Mail className="h-12 w-12 text-blue-600 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {codeSent ? 'Enter verification code' : 'Sign in with email'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
          {codeSent
            ? `We sent a 6-digit code to ${email}`
            : 'We will send a code from hello@printget.in'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!codeSent ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-4 text-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !validateEmail(email)}
            className="login-auth-btn-email py-3.5"
          >
            {isLoading ? 'Sending...' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              6-digit code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-4 text-2xl otp-input bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="one-time-code"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || code.length < 6}
            className="login-auth-btn-email py-3.5"
          >
            {isLoading ? 'Verifying...' : 'Verify and continue'}
          </button>
          <button
            type="button"
            onClick={() => onCodeSent(email)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Resend code
          </button>
        </form>
      )}
    </div>
  );
};

export default EmailCodeVerify;
