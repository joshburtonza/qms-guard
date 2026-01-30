import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
  className?: string;
}

const variantStyles = {
  default: 'border-l-primary',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
  success: 'border-l-green-500',
};

const iconVariantStyles = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-600',
  danger: 'bg-red-100 text-red-600',
  success: 'bg-green-100 text-green-600',
};

export function KPICard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default',
  onClick,
  className,
}: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'kpi-card border-l-4',
        variantStyles[variant],
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className={cn(
              'text-xs font-medium',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
            </div>
          )}
        </div>
        <div className={cn(
          'rounded-lg p-3',
          iconVariantStyles[variant]
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
