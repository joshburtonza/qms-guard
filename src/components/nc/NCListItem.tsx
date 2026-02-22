import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronRight, Clock, User } from 'lucide-react';
import { NonConformance, NC_CATEGORY_LABELS, isOverdue } from '@/types/database';
import { StatusBadge } from './StatusBadge';
import { SeverityIndicator } from './SeverityIndicator';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface NCListItemProps {
  nc: NonConformance & {
    reporter?: { full_name: string };
    responsible?: { full_name: string };
    department?: { name: string };
  };
  className?: string;
}

export function NCListItem({ nc, className }: NCListItemProps) {
  const overdue = isOverdue(nc.due_date, nc.status);
  const dueDate = new Date(nc.due_date);
  const isToday = format(dueDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const declineCount = ((nc as any).workflow_history || []).filter(
    (h: any) => h.action === 'manager_declined'
  ).length;
  const isEscalated = declineCount >= 3;

  return (
    <Link to={`/nc/${nc.id}`}>
      <Card className={cn(
        'glass-card-solid p-4 border-0 card-interactive cursor-pointer',
        overdue && 'border-l-4 !border-l-destructive',
        className
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm font-semibold text-foreground">
                {nc.nc_number}
              </span>
              <StatusBadge status={nc.status} isOverdue={overdue} isEscalated={isEscalated} />
              <SeverityIndicator severity={nc.severity} showLabel={false} />
            </div>

            {/* Category */}
            <p className="text-sm font-medium text-foreground">
              {NC_CATEGORY_LABELS[nc.category]}
              {nc.category === 'other' && nc.category_other && `: ${nc.category_other}`}
            </p>

            {/* Description Preview */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {nc.description}
            </p>

            {/* Meta Row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {nc.department && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">{nc.department.name}</span>
                </span>
              )}
              {nc.responsible && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {nc.responsible.full_name}
                </span>
              )}
              <span className={cn(
                'flex items-center gap-1',
                overdue && 'text-foreground font-medium'
              )}>
                <Clock className="h-3 w-3" />
                {isToday ? 'Due today' : (
                  overdue 
                    ? `Overdue by ${formatDistanceToNow(dueDate)}`
                    : `Due ${format(dueDate, 'MMM d, yyyy')}`
                )}
              </span>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
}
