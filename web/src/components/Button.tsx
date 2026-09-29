import React from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'h-8 px-3 text-xs gap-1.5 font-medium',
    md: 'h-9 px-4 text-[13px] gap-2 font-medium',
    lg: 'h-11 px-5 text-sm gap-2.5 font-semibold',
  };

  const variantStyles = {
    primary:
      'bg-brand text-white hover:brightness-110 active:scale-[0.98] border border-transparent shadow-sm shadow-brand/20',
    accent:
      'bg-brand-accent text-white hover:brightness-110 active:scale-[0.98] border border-transparent shadow-sm shadow-brand-accent/20',
    secondary:
      'bg-app-surface-2 text-app-text border border-app-border hover:border-app-border-strong hover:bg-app-surface-3 active:scale-[0.98]',
    ghost:
      'bg-transparent text-app-text-2 hover:text-app-text hover:bg-app-surface-2 active:scale-[0.98]',
    destructive:
      'bg-danger text-white hover:brightness-110 active:scale-[0.98] border border-transparent shadow-sm shadow-danger/20',
  };

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center radius-btn transition-all duration-150 select-none cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
