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
    color: 'text-foreground',
    bgColor: 'bg-foreground/10',
  },
  major: {
    icon: AlertCircle,
    color: 'text-foreground/70',
    bgColor: 'bg-foreground/8',
  },
  minor: {
    icon: Info,
    color: 'text-muted-foreground',
    bgColor: 'bg-foreground/5',
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
