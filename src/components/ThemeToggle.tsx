import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  if (collapsed) {
    return (
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/40 text-muted-foreground hover:text-foreground transition-all duration-200 mx-auto"
        title={`Theme: ${theme}`}
      >
        {theme === 'dark' && <Moon className="h-4 w-4" />}
        {theme === 'light' && <Sun className="h-4 w-4" />}
        {theme === 'system' && <Monitor className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div className="relative flex items-center h-8 rounded-lg bg-muted/30 border border-border/40 p-0.5">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'relative z-10 flex items-center justify-center h-7 w-7 rounded-md transition-all duration-200',
            theme === value
              ? 'bg-foreground/15 text-foreground shadow-sm'
              : 'text-muted-foreground/60 hover:text-muted-foreground'
          )}
          title={value.charAt(0).toUpperCase() + value.slice(1)}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
