import { useState } from 'react';
import { Loader2, Check, X, ExternalLink, Mail, FileDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export type ActionType = 
  | 'view_nc' 
  | 'send_reminder' 
  | 'export_report' 
  | 'confirm_action' 
  | 'create_nc'
  | 'approve'
  | 'reject'
  | 'refresh';

interface EdithActionButtonProps {
  type: ActionType;
  label: string;
  onClick: () => Promise<void> | void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
}

const ActionIcons: Record<ActionType, React.ComponentType<{ className?: string }>> = {
  view_nc: ExternalLink,
  send_reminder: Mail,
  export_report: FileDown,
  confirm_action: Check,
  create_nc: ExternalLink,
  approve: Check,
  reject: X,
  refresh: RefreshCw,
};

export function EdithActionButton({
  type,
  label,
  onClick,
  variant = 'outline',
  disabled = false,
  className,
}: EdithActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  const Icon = ActionIcons[type] || ExternalLink;

  const handleClick = async () => {
    if (loading || completed) return;
    
    setLoading(true);
    try {
      await onClick();
      setCompleted(true);
      setTimeout(() => setCompleted(false), 2000);
    } catch (error) {
      console.error('Action failed:', error);
      toast({
        title: 'Action Failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={disabled || loading}
      onClick={handleClick}
      className={cn('h-7 text-xs gap-1.5', className)}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : completed ? (
        <Check className="h-3 w-3 text-foreground" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {label}
    </Button>
  );
}

// Pre-built action button groups
interface ActionButtonGroupProps {
  ncNumber?: string;
  onViewNC?: () => void;
  onSendReminder?: () => void;
  onExport?: () => void;
}

export function NCActionButtons({ ncNumber, onViewNC, onSendReminder }: ActionButtonGroupProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {onViewNC && (
        <EdithActionButton
          type="view_nc"
          label="View NC"
          onClick={onViewNC}
        />
      )}
      {onSendReminder && (
        <EdithActionButton
          type="send_reminder"
          label="Send Reminder"
          onClick={onSendReminder}
        />
      )}
    </div>
  );
}

export function ReportActionButtons({ onExport }: ActionButtonGroupProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {onExport && (
        <EdithActionButton
          type="export_report"
          label="Export PDF"
          onClick={onExport}
        />
      )}
    </div>
  );
}

export function ConfirmActionButtons({ 
  onConfirm, 
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}: { 
  onConfirm: () => Promise<void> | void; 
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <EdithActionButton
        type="confirm_action"
        label={confirmLabel}
        onClick={onConfirm}
        variant="default"
      />
      <EdithActionButton
        type="reject"
        label={cancelLabel}
        onClick={onCancel}
        variant="outline"
      />
    </div>
  );
}
