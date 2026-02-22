import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Wrench, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface EdithStreamingMessageProps {
  content: string;
  isStreaming: boolean;
  toolStatus?: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'error';
  }[];
}

export function EdithStreamingMessage({
  content,
  isStreaming,
  toolStatus,
}: EdithStreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  
  // Smooth content update for streaming
  useEffect(() => {
    setDisplayedContent(content);
  }, [content]);

  const getToolIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-foreground/60" />;
      case 'error':
        return <span className="h-3 w-3 text-destructive">✗</span>;
      default:
        return <Wrench className="h-3 w-3" />;
    }
  };

  const formatToolName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="bg-muted rounded-lg px-4 py-2 max-w-[85%]">
      {/* Tool execution status */}
      {toolStatus && toolStatus.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {toolStatus.map((tool, index) => (
            <Badge
              key={index}
              variant="secondary"
              className={cn(
                "flex items-center gap-1 text-xs",
                tool.status === 'running' && "animate-pulse",
                tool.status === 'completed' && "bg-foreground/5",
                tool.status === 'error' && "bg-destructive/10"
              )}
            >
              {getToolIcon(tool.status)}
              <span>{formatToolName(tool.name)}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Streaming content */}
      {displayedContent ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              code: ({ className, children }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="bg-muted-foreground/20 px-1 py-0.5 rounded text-xs">{children}</code>
                ) : (
                  <code className="block bg-muted-foreground/20 p-2 rounded text-xs overflow-x-auto">{children}</code>
                );
              },
              table: ({ children }) => (
                <div className="overflow-x-auto">
                  <table className="border-collapse border border-border text-xs">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-medium">{children}</th>,
              td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
            }}
          >
            {displayedContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Thinking...</span>
        </div>
      )}

      {/* Streaming cursor */}
      {isStreaming && displayedContent && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
      )}
    </div>
  );
}
