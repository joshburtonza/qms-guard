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

const iconVariantStyles = {
  default: 'bg-foreground/5 text-foreground',
  warning: 'bg-foreground/8 text-foreground/70',
  danger: 'bg-foreground/10 text-foreground/80',
  success: 'bg-foreground/5 text-foreground/60',
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
        'kpi-card group',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-display font-bold tracking-tight">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className={cn(
              'text-xs font-medium',
              trend.isPositive ? 'text-foreground/60' : 'text-foreground/80'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
            </div>
          )}
        </div>
        <div className={cn(
          'rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110',
          iconVariantStyles[variant]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}