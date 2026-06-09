import React from 'react';
import { Check } from 'lucide-react';
import PrintGetLogo from '../PrintGetLogo';
import LoginPrintScene from './LoginPrintScene';

const HIGHLIGHTS = [
  'Real-time order notifications',
  'Silent background printing',
  'Web + desktop always in sync',
] as const;

interface LoginBrandPanelProps {
  variant?: 'auth' | 'onboarding';
  /** 0–3, synced with onboarding wizard */
  sceneStep?: number;
}

const LoginBrandPanel: React.FC<LoginBrandPanelProps> = ({
  variant = 'auth',
  sceneStep = 0,
}) => (
  <aside className="login-brand" aria-label="PrintGet Shop Manager">
    <div className="login-brand__mesh" />
    <div className="login-brand__content">
      <div className="login-brand__logo login-anim-fade-up">
        <PrintGetLogo size="lg" />
      </div>

      <h1 className="login-brand__title login-anim-fade-up login-anim-delay-1">
        Shop Manager
      </h1>
      <p className="login-brand__lead login-anim-fade-up login-anim-delay-2">
        The desktop command center for your print shop — orders, printers, and pricing in one
        place.
      </p>

      <ul className="login-brand__highlights login-anim-fade-up login-anim-delay-3">
        {HIGHLIGHTS.map((text) => (
          <li key={text}>
            <span className="login-brand__check">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <div className="login-brand__scene login-anim-fade-up login-anim-delay-4">
        <LoginPrintScene step={variant === 'onboarding' ? sceneStep : 0} />
      </div>
    </div>
  </aside>
);

export default LoginBrandPanel;
