import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle } from 'lucide-react';
import type { OnboardingData } from '../../utils/auth';
import { validatePhone } from '../../utils/auth';
import OwnerContactStep from './steps/OwnerContactStep';
import ShopIdentityStep from './steps/ShopIdentityStep';
import ShopLocationStep from './steps/ShopLocationStep';
import ReviewStep from './steps/ReviewStep';
import './signup.css';

const EMPTY: OnboardingData = {
  name: '',
  phone: '',
  shopName: '',
  businessType: '',
  address: '',
  googleMapsLink: '',
  latitude: '',
  longitude: '',
};

const STEP_LABELS = ['About you', 'Your shop', 'Location', 'Review'] as const;

interface OnboardingWizardProps {
  email: string;
  initialData?: Partial<OnboardingData>;
  onComplete: (data: OnboardingData) => void;
  isSubmitting: boolean;
  error?: string;
  onStepChange?: (step: number) => void;
}

const STEPS = 4;

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  email,
  initialData,
  onComplete,
  isSubmitting,
  error,
  onStepChange,
}) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [data, setData] = useState<OnboardingData>({ ...EMPTY, ...initialData });

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  const patch = (p: Partial<OnboardingData>) => setData((d) => ({ ...d, ...p }));

  const progress = ((step + 1) / STEPS) * 100;

  const canContinue = (): boolean => {
    switch (step) {
      case 0:
        return data.name.trim().length >= 2 && validatePhone(data.phone);
      case 1:
        return (
          data.shopName.trim().length >= 2 &&
          !!data.businessType &&
          (data.businessType !== 'other' || !!(data.businessTypeOther?.trim()))
        );
      case 2:
        return (
          data.address.trim().length >= 5 &&
          !!data.latitude.trim() &&
          !!data.longitude.trim()
        );
      case 3:
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (step < STEPS - 1) {
      setDirection('forward');
      setStep((s) => s + 1);
    } else {
      onComplete(data);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection('back');
      setStep((s) => s - 1);
    }
  };

  const animClass = direction === 'forward' ? 'signup-step-enter' : 'signup-step-enter-back';

  return (
    <div className="onboarding-wizard">
      <header className="onboarding-wizard__header">
        <h2 className="onboarding-wizard__title">Set up your shop</h2>
        <p className="onboarding-wizard__meta">
          Step {step + 1} of {STEPS}
          <span className="onboarding-wizard__meta-sep" aria-hidden>
            ·
          </span>
          {Math.round(progress)}% complete
        </p>
      </header>

      <ol className="onboarding-stepper" aria-label="Setup steps">
        {STEP_LABELS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li
              key={label}
              className={`onboarding-stepper__item${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="onboarding-stepper__dot" aria-hidden>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="onboarding-stepper__label">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="onboarding-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="onboarding-progress__fill signup-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {error && (
        <div className="onboarding-wizard__error" role="alert">
          {error}
        </div>
      )}

      <div key={step} className={`onboarding-wizard__body ${animClass}`}>
        {step === 0 && <OwnerContactStep data={data} onChange={patch} />}
        {step === 1 && <ShopIdentityStep data={data} onChange={patch} />}
        {step === 2 && <ShopLocationStep data={data} onChange={patch} />}
        {step === 3 && <ReviewStep data={data} email={email} />}
      </div>

      <div className="onboarding-wizard__actions">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isSubmitting}
            className="onboarding-wizard__btn onboarding-wizard__btn--back"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={!canContinue() || isSubmitting}
          className="onboarding-wizard__btn onboarding-wizard__btn--next"
        >
          {isSubmitting ? (
            'Setting up...'
          ) : step === STEPS - 1 ? (
            <>
              <CheckCircle className="h-5 w-5" />
              Finish setup
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OnboardingWizard;
