import React from 'react';
import { Building } from 'lucide-react';
import { BUSINESS_TYPES, type OnboardingData } from '../../../utils/auth';

interface ShopIdentityStepProps {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
}

const ShopIdentityStep: React.FC<ShopIdentityStepProps> = ({ data, onChange }) => (
  <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Your shop</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">How customers will find you</p>
    </div>
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
        <Building className="h-4 w-4 inline mr-2" />
        Shop / business name
      </label>
      <input
        type="text"
        value={data.shopName}
        onChange={(e) => onChange({ shopName: e.target.value })}
        placeholder="City Xerox Center"
        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
        Business type
      </label>
      <select
        value={data.businessType}
        onChange={(e) => onChange({ businessType: e.target.value })}
        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select type...</option>
        {BUSINESS_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
    {data.businessType === 'other' && (
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Describe your business
        </label>
        <input
          type="text"
          value={data.businessTypeOther || ''}
          onChange={(e) => onChange({ businessTypeOther: e.target.value })}
          placeholder="e.g. Design studio with printing"
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    )}
  </div>
);

export default ShopIdentityStep;
