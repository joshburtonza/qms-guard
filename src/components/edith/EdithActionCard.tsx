import { useState } from 'react';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EdithActionCardProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
  variant?: 'default' | 'destructive';
  isDestructive?: boolean;
  details?: string[];
}

export function EdithActionCard({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  isDestructive = false,
  details,
}: EdithActionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
      setIsCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <Check className="h-5 w-5" />
          <span className="font-medium">Action completed</span>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "p-4",
        isDestructive && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex items-start gap-3">
        {isDestructive && (
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
        )}
        <div className="flex-1">
          <h4 className="font-medium text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          
          {details && details.length > 0 && (
            <ul className="mt-2 space-y-1">
              {details.map((detail, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  {detail}
                </li>
              ))}
            </ul>
          )}
          
          {error && (
            <p className="text-xs text-destructive mt-2">{error}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button
          variant={isDestructive ? 'destructive' : 'default'}
          size="sm"
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              {confirmLabel}
            </>
          )}
        </Button>
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-1" />
            {cancelLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
