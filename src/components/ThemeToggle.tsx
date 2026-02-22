import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (collapsed) {
    return (
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
        className="flex items-center justify-center h-9 w-9 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 mx-auto"
        title={`Theme: ${theme}`}
      >
        {theme === 'dark' && <Moon className="h-4 w-4" />}
        {theme === 'light' && <Sun className="h-4 w-4" />}
        {theme === 'system' && <Monitor className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-secondary/50 p-1">
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200',
          theme === 'light'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        title="Light mode"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200',
          theme === 'dark'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        title="Dark mode"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={cn(
          'flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200',
          theme === 'system'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        title="System"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
