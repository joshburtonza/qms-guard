import { Lock, Unlock, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { getRoleLabel, getStepDescription } from '@/hooks/useFieldLocking';

interface FieldLockIndicatorProps {
  isLocked: boolean;
  reason?: string;
}

export function FieldLockIndicator({ isLocked, reason }: FieldLockIndicatorProps) {
  if (!isLocked) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className="h-3.5 w-3.5 text-muted-foreground ml-1 inline-block" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{reason || 'This field is locked'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CurrentRoleBadgeProps {
  userRole: string;
  currentStep: number;
}

export function CurrentRoleBadge({ userRole, currentStep }: CurrentRoleBadgeProps) {
  const roleLabel = getRoleLabel(userRole);
  const stepLabel = getStepDescription(currentStep);
  
  const colorMap: Record<string, string> = {
    admin: 'bg-foreground/10 text-foreground border-foreground/20',
    qa: 'bg-foreground/8 text-foreground/80 border-foreground/15',
    responsible_person: 'bg-foreground/6 text-foreground/70 border-foreground/10',
    manager: 'bg-foreground/8 text-foreground/70 border-foreground/15',
    verifier: 'bg-foreground/6 text-foreground/60 border-foreground/10',
    viewer: 'bg-foreground/5 text-muted-foreground border-foreground/10',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className={colorMap[userRole] || colorMap.viewer}>
        {roleLabel}
      </Badge>
      <span className="text-sm text-muted-foreground">
        Step {currentStep}: {stepLabel}
      </span>
      {userRole === 'viewer' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                You can view this NC but cannot make changes at this step. 
                Only authorized roles can edit specific fields.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

interface FieldLockSummaryProps {
  editableCount: number;
  totalCount: number;
  userRole: string;
}

export function FieldLockSummary({ editableCount, totalCount, userRole }: FieldLockSummaryProps) {
  if (userRole === 'admin') {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground/70">
        <Unlock className="h-4 w-4" />
        <span>Admin mode: All fields editable</span>
      </div>
    );
  }

  if (editableCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        <span>No fields editable at this step</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Unlock className="h-4 w-4 text-foreground/50" />
      <span>
        {editableCount} of {totalCount} fields editable
      </span>
    </div>
  );
}
