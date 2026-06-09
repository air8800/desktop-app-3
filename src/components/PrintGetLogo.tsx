import React from 'react';
import logoUrl from '/favicon.svg?url';
const markSizes = {
  sm: 'h-6 w-6 rounded-md',
  md: 'h-7 w-7 rounded-lg',
  lg: 'h-9 w-9 rounded-lg',
};

const textSizes = {
  sm: 'text-base font-bold tracking-tight',
  md: 'text-lg font-bold tracking-tight',
  lg: 'text-xl font-bold tracking-tight',
};

interface PrintGetLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'default' | 'light';
  className?: string;
}

const PrintGetLogo: React.FC<PrintGetLogoProps> = ({
  size = 'md',
  showText = true,
  variant = 'default',
  className = '',
}) => {
  const printColor = variant === 'light' ? 'text-white' : 'text-gray-900';
  const getGradient =
    variant === 'light'
      ? 'bg-gradient-to-r from-blue-400 to-indigo-400'
      : 'bg-gradient-to-r from-blue-600 to-indigo-600';

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <span className={`${markSizes[size]} overflow-hidden flex-shrink-0 block`} aria-hidden>
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
        />
      </span>
      {showText && (
        <span className={`${textSizes[size]} ${printColor} leading-none`}>
          Print
          <span className={`text-transparent bg-clip-text ${getGradient}`}>Get</span>
        </span>
      )}
    </div>
  );
};

export default PrintGetLogo;
