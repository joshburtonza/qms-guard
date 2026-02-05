import { ListTodo, AlertTriangle, Plus, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEdith } from '@/hooks/useEdith';
import { QUICK_ACTIONS } from '@/types/edith';

const iconMap = {
  ListTodo,
  AlertTriangle,
  Plus,
  BarChart: BarChart3,
};

export function EdithToolbar() {
  const { sendMessage, isLoading } = useEdith();

  return (
    <div className="flex flex-wrap gap-2 p-3 border-b bg-muted/30">
      {QUICK_ACTIONS.map((action) => {
        const Icon = iconMap[action.icon as keyof typeof iconMap];
        return (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => sendMessage(action.message)}
          >
            {Icon && <Icon className="h-3 w-3 mr-1" />}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
