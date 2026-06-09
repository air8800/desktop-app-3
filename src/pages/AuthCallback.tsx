import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeOAuthFromTokens } from '../utils/auth';

const AuthCallback: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Completing sign-in...');

  useEffect(() => {
    const run = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || undefined;
      const oauthError = params.get('error_description') || params.get('error');

      if (oauthError) {
        setError(decodeURIComponent(oauthError));
        return;
      }

      if (!accessToken) {
        setError('Sign-in was cancelled or failed. Please try again.');
        return;
      }

      // Opened in system browser after Google — hand tokens to the desktop app
      if (!window.electron && hash) {
        setStatus('Returning to PrintGet app...');
        window.location.href = `printget://auth/callback#${hash}`;
        return;
      }

      const result = await completeOAuthFromTokens(accessToken, refreshToken);
      if (!result.success || !result.user) {
        setError(result.error || 'Could not complete sign-in');
        return;
      }

      onLogin({
        ...result.user,
        token: result.token,
        needsOnboarding: result.needsOnboarding,
      });

      navigate('/', { replace: true });
    };
    run();
  }, [navigate, onLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
      <div className="text-center p-8">
        {error ? (
          <>
            <p className="text-red-600 mb-4">{error}</p>
            <a href={window.location.protocol === 'file:' ? '#/' : '/'} className="text-blue-600 font-semibold">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">{status}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
