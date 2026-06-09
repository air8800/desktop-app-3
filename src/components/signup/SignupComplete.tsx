import React from 'react';
import { CheckCircle, Printer } from 'lucide-react';

interface SignupCompleteProps {
  shopName: string;
}

const SignupComplete: React.FC<SignupCompleteProps> = ({ shopName }) => (
  <div className="text-center space-y-6 signup-check-pop py-8">
    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
      <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
    </div>
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">You are onboard!</h2>
      <p className="text-slate-600 dark:text-slate-400 mt-2">
        <strong>{shopName}</strong> is ready on PrintGet. Check your inbox for a welcome email from
        hello@printget.in
      </p>
    </div>
    <Printer className="h-8 w-8 text-blue-600 mx-auto animate-pulse" />
  </div>
);

export default SignupComplete;
