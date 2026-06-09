import React from 'react';
import { BUSINESS_TYPES, type OnboardingData } from '../../../utils/auth';

interface ReviewStepProps {
  data: OnboardingData;
  email: string;
}

const ReviewStep: React.FC<ReviewStepProps> = ({ data, email }) => {
  const businessLabel =
    BUSINESS_TYPES.find((t) => t.value === data.businessType)?.label ||
    data.businessTypeOther ||
    data.businessType;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Review your details</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Confirm everything looks correct before finishing setup
        </p>
      </div>
      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-2xl p-5 space-y-3 text-sm border border-slate-200 dark:border-slate-700">
        <Row label="Email" value={email} />
        <Row label="Name" value={data.name} />
        <Row label="Phone" value={data.phone} />
        <Row label="Shop" value={data.shopName} />
        <Row label="Business type" value={businessLabel} />
        <Row label="Address" value={data.address} />
        <Row
          label="Location"
          value={
            data.latitude && data.longitude
              ? `${data.latitude}, ${data.longitude}`
              : 'Not set'
          }
        />
      </div>
      <p className="text-xs text-slate-500">
        After you finish, we will send a welcome email from hello@printget.in
      </p>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200/80 dark:border-slate-700/80 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 dark:text-white text-right">{value || '—'}</span>
    </div>
  );
}

export default ReviewStep;
