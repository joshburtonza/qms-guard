import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEdith } from '@/hooks/useEdith';
import { useEdithBadge } from '@/hooks/useEdithBadge';
import { cn } from '@/lib/utils';

export function EdithFloatingButton() {
  const { toggleEdith, isOpen, isLoading } = useEdith();
  const badge = useEdithBadge();

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <Button
        onClick={toggleEdith}
        className={cn(
          'h-14 w-14 rounded-full shadow-lg',
          'bg-primary hover:bg-primary/90',
          'transition-all duration-300 ease-in-out',
          isOpen && 'scale-0 opacity-0',
          isLoading && 'animate-pulse'
        )}
        size="icon"
        aria-label="Open Edith AI Assistant"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </Button>

      {/* Notification Badge */}
      {badge.count > 0 && !isOpen && (
        <span
          className={cn(
            'absolute -top-1 -right-1 flex items-center justify-center',
            'min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold',
            'transition-all duration-300 ease-in-out',
            badge.hasUrgent
              ? 'bg-destructive text-destructive-foreground animate-pulse'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {badge.count > 99 ? '99+' : badge.count}
        </span>
      )}
    </div>
  );
}
