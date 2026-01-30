import { NCSeverity, NC_SEVERITY_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface SeverityIndicatorProps {
  severity: NCSeverity;
  showLabel?: boolean;
  className?: string;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  major: {
    icon: AlertCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  minor: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
};

export function SeverityIndicator({ severity, showLabel = true, className }: SeverityIndicatorProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className={cn('rounded p-1', config.bgColor)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      {showLabel && (
        <span className={cn('font-medium text-sm', config.color)}>
          {NC_SEVERITY_LABELS[severity]}
        </span>
      )}
    </div>
  );
}
