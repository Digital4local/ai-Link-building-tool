import React from 'react';
import { clsx } from 'clsx';
import { Sparkles, Zap, FileText, FolderKanban, CheckCircle2, Clock, MessageSquare, XCircle } from 'lucide-react';

export type BadgeVariant =
  | 'brand'
  | 'brand-accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'high-priority'
  | 'quick-win'
  | 'editorial'
  | 'directory';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className,
  dot = false,
}) => {
  const getAutoIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case 'high-priority':
        return <Sparkles className="w-3 h-3" />;
      case 'quick-win':
        return <Zap className="w-3 h-3" />;
      case 'editorial':
        return <FileText className="w-3 h-3" />;
      case 'directory':
        return <FolderKanban className="w-3 h-3" />;
      case 'success':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'warning':
        return <Clock className="w-3 h-3" />;
      case 'danger':
        return <XCircle className="w-3 h-3" />;
      case 'info':
        return <MessageSquare className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const variantStyles = {
    brand: 'bg-brand/12 text-brand border-brand/20',
    'brand-accent': 'bg-brand-accent/15 text-brand-accent border-brand-accent/25',
    success: 'bg-success/12 text-success border-success/20',
    warning: 'bg-warning/12 text-warning border-warning/20',
    danger: 'bg-danger/12 text-danger border-danger/20',
    info: 'bg-info/12 text-info border-info/20',
    neutral: 'bg-app-surface-2 text-app-text-2 border-app-border',
    'high-priority': 'bg-brand/15 text-brand border-brand/30 font-semibold',
    'quick-win': 'bg-brand-accent/15 text-brand-accent border-brand-accent/30 font-semibold',
    editorial: 'bg-info/15 text-info border-info/25',
    directory: 'bg-app-surface-3 text-app-text-2 border-app-border-strong',
  };

  const sizeStyles = {
    sm: 'h-5 px-1.5 text-[11px] gap-1 radius-badge font-medium',
    md: 'h-6 px-2.5 text-xs gap-1.5 radius-badge font-medium',
  };

  const autoIcon = getAutoIcon();

  return (
    <span
      className={clsx(
        'inline-flex items-center border select-none transition-colors duration-150',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'success' || variant === 'quick-win'
              ? 'bg-success'
              : variant === 'warning'
              ? 'bg-warning'
              : variant === 'danger'
              ? 'bg-danger'
              : variant === 'brand' || variant === 'high-priority'
              ? 'bg-brand'
              : variant === 'brand-accent'
              ? 'bg-brand-accent'
              : 'bg-app-text-3'
          )}
        />
      )}
      {autoIcon && !dot && <span className="shrink-0">{autoIcon}</span>}
      <span>{children}</span>
    </span>
  );
};
