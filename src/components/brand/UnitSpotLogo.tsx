import React, { useId } from 'react';

interface LogoProps {
  variant?: 'light' | 'dark' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

export const UnitSpotLogo: React.FC<LogoProps> = ({
  variant = 'auto',
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const unitGradId = `unitGrad-${uid}`;
  const spotGradId = `spotGrad-${uid}`;

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

  const isForcedDark = variant === 'dark';
  const isAuto = variant === 'auto';

  const wordmarkColorClass = isForcedDark
    ? 'text-white'
    : isAuto
      ? 'text-slate-900 dark:text-white'
      : 'text-slate-900';

  const subtitleColorClass = isForcedDark
    ? 'text-slate-400'
    : isAuto
      ? 'text-slate-500 dark:text-slate-400'
      : 'text-slate-500';

  const displayClass = /\bhidden\b|\bflex\b|\binline-flex\b|\bblock\b/.test(className)
    ? ''
    : 'inline-flex';

  return (
    <div className={`${displayClass} items-center gap-2 sm:gap-2.5 select-none shrink-0 ${className}`.trim()}>
      <div
        className={`relative ${iconSizes[size]} rounded-xl flex items-center justify-center font-bold shadow-xs transition-transform duration-200 group-hover:scale-105 bg-gradient-to-br from-[#0F172A] to-[#070B14] dark:from-[#16223D] dark:to-[#0B1222] border border-[#D5A52B]/50`}
        style={{
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
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
            fill={`url(#${unitGradId})`}
          />
          <circle cx="16" cy="13" r="3.5" fill={`url(#${spotGradId})`} />
          <defs>
            <linearGradient
              id={unitGradId}
              x1="7"
              y1="7"
              x2="25"
              y2="27"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FFFFFF" />
              <stop offset="0.6" stopColor="#E2E8F0" />
              <stop offset="1" stopColor="#D5A52B" />
            </linearGradient>
            <linearGradient
              id={spotGradId}
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
              className={`font-extrabold ${textSizes[size]} tracking-tight ${wordmarkColorClass}`}
            >
              Unit<span className="text-[#D5A52B]">Spot</span>
            </span>
          </div>
          <span className={`text-[9px] tracking-widest font-semibold uppercase mt-0.5 whitespace-nowrap ${subtitleColorClass}`}>
            Accommodation &amp; Finance
          </span>
        </div>
      )}
    </div>
  );
};

export const KlarencyLogo = UnitSpotLogo;
