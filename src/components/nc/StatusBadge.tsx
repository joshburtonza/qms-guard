import { NCStatus, NC_STATUS_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: NCStatus;
  isOverdue?: boolean;
  className?: string;
}

const statusStyles: Record<NCStatus, string> = {
  open: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  pending_review: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
  pending_verification: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  closed: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  rejected: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
};

export function StatusBadge({ status, isOverdue, className }: StatusBadgeProps) {
  if (isOverdue) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          'bg-red-100 text-red-800 border-red-200 animate-pulse-subtle',
          className
        )}
      >
        Overdue
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(statusStyles[status], className)}
    >
      {NC_STATUS_LABELS[status]}
    </Badge>
  );
}
