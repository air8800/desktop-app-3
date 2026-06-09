import React, { useEffect, useState } from 'react';
import PrintGetLogo from '../components/PrintGetLogo';
import {
  requestEmailCode,
  verifyEmailCode,
  signInWithGoogle,
  completePartnerOnboarding,
  type OnboardingData,
} from '../utils/auth';
import { getStoredSession } from '../utils/sessionStorage';
import AuthWelcome from '../components/signup/AuthWelcome';
import EmailCodeVerify from '../components/signup/EmailCodeVerify';
import OnboardingWizard from '../components/signup/OnboardingWizard';
import SignupComplete from '../components/signup/SignupComplete';
import LoginBrandPanel from '../components/signup/LoginBrandPanel';
import '../components/signup/signup.css';

type Phase = 'welcome' | 'email' | 'onboarding' | 'complete';

interface LoginProps {
  onLogin: (userData: unknown) => void;
  forceOnboarding?: boolean;
  authError?: string;
  onClearAuthError?: () => void;
  isOAuthLoading?: boolean;
  onOAuthStart?: () => void;
}

const Login: React.FC<LoginProps> = ({
  onLogin,
  forceOnboarding = false,
  authError = '',
  onClearAuthError,
  isOAuthLoading = false,
  onOAuthStart,
}) => {
  const [phase, setPhase] = useState<Phase>(forceOnboarding ? 'onboarding' : 'welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [userId, setUserId] = useState('');
  const [shopNameDone, setShopNameDone] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    if (!forceOnboarding) return;
    getStoredSession().then((s) => {
      if (s) {
        setEmail(s.user.email);
        setAccessToken(s.accessToken);
        setUserId(s.user.id);
        setPhase('onboarding');
      }
    });
  }, [forceOnboarding]);

  const handleGoogle = async () => {
    setError('');
    onClearAuthError?.();
    setIsLoading(true);
    onOAuthStart?.();
    const result = await signInWithGoogle();
    if (!result.success) {
      setIsLoading(false);
      setError(result.error || 'Google sign-in failed');
    }
  };

  const displayError = error || authError;
  const googleLoading = isLoading || isOAuthLoading;

  const handleSendCode = async (addr: string) => {
    setError('');
    setIsLoading(true);
    const result = await requestEmailCode(addr);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to send code');
      return;
    }
    setEmail(addr);
    setCodeSent(true);
  };

  const handleVerify = async (addr: string, code: string) => {
    setError('');
    setIsLoading(true);
    const result = await verifyEmailCode(addr, code);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Invalid code');
      return;
    }
    setEmail(addr);
    setAccessToken(result.token || '');
    setUserId(result.user?.id || '');

    if (result.needsOnboarding) {
      setPhase('onboarding');
    } else if (result.user) {
      onLogin({ ...result.user, token: result.token, needsOnboarding: result.needsOnboarding });
    }
  };

  const handleOnboardingComplete = async (data: OnboardingData) => {
    setError('');
    setIsLoading(true);
    const result = await completePartnerOnboarding(data, accessToken, userId, email);
    setIsLoading(false);
    if (!result.success || !result.user) {
      setError(result.error || 'Setup failed');
      return;
    }
    setShopNameDone(data.shopName);
    setPhase('complete');
    setTimeout(() => {
      onLogin({ ...result.user, token: accessToken });
    }, 2200);
  };

  const showBrandPanel = phase !== 'complete';
  const isWideCard = phase === 'onboarding';
  const brandVariant = phase === 'onboarding' ? 'onboarding' : 'auth';

  return (
    <div className="login-page">
      <div className="login-page__backdrop" aria-hidden>
        <div className="login-page__grid" />
        <div className="login-page__glow login-page__glow--a" />
        <div className="login-page__glow login-page__glow--b" />
      </div>

      <div className="login-page__layout">
        {showBrandPanel && (
          <LoginBrandPanel variant={brandVariant} sceneStep={onboardingStep} />
        )}

        <div className="login-page__form-col">
          <div
            className={`login-card-shell${isWideCard ? ' login-card-shell--wide' : ''}`}
            key={phase}
          >
            <div className="login-card">
              {phase === 'welcome' && (
                <AuthWelcome
                  onGoogle={handleGoogle}
                  onEmail={() => {
                    setPhase('email');
                    setCodeSent(false);
                    setError('');
                  }}
                  isLoading={googleLoading}
                  error={displayError}
                />
              )}
              {phase === 'email' && (
                <EmailCodeVerify
                  onBack={() => {
                    setPhase('welcome');
                    setCodeSent(false);
                    setError('');
                  }}
                  onCodeSent={handleSendCode}
                  onVerify={handleVerify}
                  isLoading={isLoading}
                  error={error}
                  initialEmail={email}
                  codeSent={codeSent}
                />
              )}
              {phase === 'onboarding' && (
                <OnboardingWizard
                  email={email}
                  onComplete={handleOnboardingComplete}
                  isSubmitting={isLoading}
                  error={error}
                  onStepChange={setOnboardingStep}
                />
              )}
              {phase === 'complete' && (
                <div className="login-card__mobile-logo">
                  <PrintGetLogo size="md" />
                </div>
              )}
              {phase === 'complete' && <SignupComplete shopName={shopNameDone} />}
            </div>
          </div>

          <p className="login-page__footer">
            © PrintGet · Trusted by print shops across India
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
