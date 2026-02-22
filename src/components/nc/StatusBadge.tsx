import { NCStatus, NC_STATUS_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: NCStatus;
  isOverdue?: boolean;
  isEscalated?: boolean;
  className?: string;
}

const statusStyles: Record<NCStatus, string> = {
  open: 'bg-foreground/10 text-foreground border-foreground/20 hover:bg-foreground/10',
  in_progress: 'bg-foreground/8 text-foreground/80 border-foreground/15 hover:bg-foreground/8',
  pending_review: 'bg-foreground/6 text-foreground/70 border-foreground/10 hover:bg-foreground/6',
  pending_verification: 'bg-foreground/8 text-foreground/70 border-foreground/15 hover:bg-foreground/8',
  closed: 'bg-foreground/5 text-foreground/50 border-foreground/10 hover:bg-foreground/5',
  rejected: 'bg-foreground/10 text-foreground/70 border-foreground/20 hover:bg-foreground/10',
};

export function StatusBadge({ status, isOverdue, isEscalated, className }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      {isOverdue ? (
        <Badge 
          variant="outline" 
          className={cn(
            'bg-foreground/12 text-foreground border-foreground/25 animate-pulse',
            className
          )}
        >
          Overdue
        </Badge>
      ) : (
        <Badge 
          variant="outline" 
          className={cn(statusStyles[status], className)}
        >
          {NC_STATUS_LABELS[status]}
        </Badge>
      )}
      {isEscalated && (
        <Badge 
          variant="outline" 
          className="bg-foreground/10 text-foreground border-foreground/20"
        >
          ESCALATED
        </Badge>
      )}
    </div>
  );
}
