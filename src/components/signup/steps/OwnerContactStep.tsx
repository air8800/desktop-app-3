import React from 'react';
import { User, Phone } from 'lucide-react';
import type { OnboardingData } from '../../../utils/auth';
import { validatePhone } from '../../../utils/auth';

interface OwnerContactStepProps {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
}

const OwnerContactStep: React.FC<OwnerContactStepProps> = ({ data, onChange }) => (
  <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">About you</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">Your name and contact number</p>
    </div>
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
        <User className="h-4 w-4 inline mr-2" />
        Full name
      </label>
      <input
        type="text"
        value={data.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Your full name"
        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="name"
      />
    </div>
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
        <Phone className="h-4 w-4 inline mr-2" />
        Phone number
      </label>
      <input
        type="tel"
        value={data.phone}
        onChange={(e) => onChange({ phone: e.target.value })}
        placeholder="+91 9876543210"
        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="tel"
      />
      {data.phone && !validatePhone(data.phone) && (
        <p className="text-xs text-red-500 mt-1">Enter a valid phone number (10+ digits)</p>
      )}
    </div>
  </div>
);

export default OwnerContactStep;
