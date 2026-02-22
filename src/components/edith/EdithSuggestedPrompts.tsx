import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ListTodo, 
  AlertTriangle, 
  Plus, 
  BarChart, 
  FileText, 
  FileDown,
  TrendingUp,
  Users,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EdithPageContext, PAGE_SUGGESTIONS } from '@/types/edith';

interface EdithSuggestedPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  customPrompts?: string[];
  isLoading?: boolean;
  variant?: 'inline' | 'grid';
}

const PROMPT_ICONS: Record<string, React.ReactNode> = {
  'show': <ListTodo className="h-3 w-3" />,
  'overdue': <AlertTriangle className="h-3 w-3" />,
  'create': <Plus className="h-3 w-3" />,
  'new': <Plus className="h-3 w-3" />,
  'trends': <TrendingUp className="h-3 w-3" />,
  'stats': <BarChart className="h-3 w-3" />,
  'report': <FileDown className="h-3 w-3" />,
  'generate': <FileDown className="h-3 w-3" />,
  'export': <FileDown className="h-3 w-3" />,
  'iso': <FileText className="h-3 w-3" />,
  'clause': <FileText className="h-3 w-3" />,
  'audit': <ClipboardCheck className="h-3 w-3" />,
  'who': <Users className="h-3 w-3" />,
  'analyze': <BarChart className="h-3 w-3" />,
  'help': <Sparkles className="h-3 w-3" />,
  'what': <Sparkles className="h-3 w-3" />,
};

const DEFAULT_SUGGESTIONS: Record<EdithPageContext, string[]> = {
  dashboard: [
    "What's overdue?",
    "Show NC trends this month",
    "Generate performance report"
  ],
  ncList: [
    "Find NCs missing root cause",
    "Who has the most open actions?",
    "Export this list as Excel"
  ],
  ncDetail: [
    "What ISO clause applies to this NC?",
    "Draft corrective action",
    "Send reminder"
  ],
  tasks: [
    "Show my overdue tasks",
    "Prioritize my workload",
    "What should I focus on?"
  ],
  audits: [
    "Prepare audit checklist",
    "Show recent findings",
    "What evidence do I need?"
  ],
  surveys: [
    "Analyze survey trends",
    "Show low satisfaction",
    "Generate summary"
  ],
  moderation: [
    "Show pending moderations",
    "What's my queue?",
    "Generate report"
  ],
  settings: [
    "Help me configure Edith",
    "What are my limits?",
    "Show system status"
  ],
  fullPageEdith: [
    "Import data from spreadsheet",
    "Help me write a procedure",
    "Prepare audit checklist",
    "Analyze NC patterns"
  ],
  other: [
    "Show my tasks",
    "What's overdue?",
    "Help with compliance"
  ],
};

function getPageContext(pathname: string): EdithPageContext {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname === '/nc') return 'ncList';
  if (pathname.startsWith('/nc/')) return 'ncDetail';
  if (pathname === '/tasks') return 'tasks';
  if (pathname.startsWith('/audits')) return 'audits';
  if (pathname.startsWith('/surveys')) return 'surveys';
  if (pathname.startsWith('/moderation')) return 'moderation';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname === '/edith') return 'fullPageEdith';
  return 'other';
}

function getIconForPrompt(prompt: string): React.ReactNode {
  const lowerPrompt = prompt.toLowerCase();
  for (const [key, icon] of Object.entries(PROMPT_ICONS)) {
    if (lowerPrompt.includes(key)) {
      return icon;
    }
  }
  return <Sparkles className="h-3 w-3" />;
}

export function EdithSuggestedPrompts({
  onSelectPrompt,
  customPrompts,
  isLoading,
  variant = 'inline',
}: EdithSuggestedPromptsProps) {
  const location = useLocation();
  const pageContext = getPageContext(location.pathname);
  const suggestions = customPrompts || DEFAULT_SUGGESTIONS[pageContext];

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-2 p-4">
        {suggestions.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-3 px-4 text-left justify-start gap-2 whitespace-normal"
            onClick={() => onSelectPrompt(prompt)}
            disabled={isLoading}
          >
            {getIconForPrompt(prompt)}
            <span className="text-xs leading-tight">{prompt}</span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 p-3 border-t bg-muted/30">
      <span className="text-xs text-muted-foreground flex items-center mr-1">
        <Sparkles className="h-3 w-3 mr-1" />
        Try:
      </span>
      {suggestions.slice(0, 3).map((prompt, index) => (
        <Button
          key={index}
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 text-xs px-2 py-1 rounded-full",
            "bg-background hover:bg-foreground/10 hover:text-foreground",
            "border border-border"
          )}
          onClick={() => onSelectPrompt(prompt)}
          disabled={isLoading}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}
