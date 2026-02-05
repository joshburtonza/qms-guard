import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEdith } from '@/hooks/useEdith';
import { cn } from '@/lib/utils';

export function EdithFloatingButton() {
  const { toggleEdith, isOpen, isLoading } = useEdith();

  return (
    <Button
      onClick={toggleEdith}
      className={cn(
        'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg',
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
  );
}
