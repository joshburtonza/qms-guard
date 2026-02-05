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
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
    qa: 'bg-blue-100 text-blue-700 border-blue-200',
    responsible_person: 'bg-amber-100 text-amber-700 border-amber-200',
    manager: 'bg-green-100 text-green-700 border-green-200',
    verifier: 'bg-teal-100 text-teal-700 border-teal-200',
    viewer: 'bg-gray-100 text-gray-600 border-gray-200',
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
      <div className="flex items-center gap-2 text-sm text-purple-600">
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
      <Unlock className="h-4 w-4 text-green-500" />
      <span>
        {editableCount} of {totalCount} fields editable
      </span>
    </div>
  );
}
