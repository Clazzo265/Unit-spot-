import React from 'react';

interface LogoProps {
  variant?: 'light' | 'dark' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

export const UnitSpotLogo: React.FC<LogoProps> = ({
  variant = 'light',
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const isDark = variant === 'dark';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      <div
        className={`relative ${iconSizes[size]} rounded-xl flex items-center justify-center font-bold shadow-xs transition-transform duration-200 group-hover:scale-105`}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #1C1C1E 0%, #0F0F10 100%)'
            : 'linear-gradient(135deg, #111111 0%, #1A1A1A 100%)',
          border: '1px solid rgba(213, 165, 43, 0.45)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
        }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-3/5 h-3/5"
        >
          <path
            d="M7 7H12V18C12 20.2091 13.7909 22 16 22C18.2091 22 20 20.2091 20 18V7H25V18C25 22.9706 20.9706 27 16 27C11.0294 27 7 22.9706 7 18V7Z"
            fill="url(#unitGradient)"
          />
          <circle cx="16" cy="13" r="3.5" fill="url(#spotGoldGradient)" />
          <defs>
            <linearGradient
              id="unitGradient"
              x1="7"
              y1="7"
              x2="25"
              y2="27"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FFFFFF" />
              <stop offset="0.6" stopColor="#E5E5E5" />
              <stop offset="1" stopColor="#D5A52B" />
            </linearGradient>
            <linearGradient
              id="spotGoldGradient"
              x1="12.5"
              y1="9.5"
              x2="19.5"
              y2="16.5"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F5D061" />
              <stop offset="1" stopColor="#D5A52B" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center tracking-tight">
            <span
              className={`font-extrabold ${textSizes[size]} tracking-tight ${
                isDark ? 'text-white' : 'text-[#111111]'
              }`}
            >
              Unit<span className="text-[#D5A52B]">Spot</span>
            </span>
          </div>
          <span className="text-[9px] tracking-widest font-semibold uppercase text-[#808080] mt-0.5 whitespace-nowrap">
            Accommodation &amp; Finance
          </span>
        </div>
      )}
    </div>
  );
};

export const KlarencyLogo = UnitSpotLogo;
