import { useRef, useEffect, useState } from 'react';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEdith } from '@/hooks/useEdith';
import { EdithInput } from './EdithInput';
import { EdithMessageActions } from './EdithMessageActions';
import { EdithStreamingMessage } from './EdithStreamingMessage';
import { EdithSuggestedPrompts } from './EdithSuggestedPrompts';
import type { EdithMessage } from '@/types/edith';

export function EdithChat() {
  const { 
    currentConversation, 
    isLoading, 
    isStreaming,
    streamingContent,
    sendMessage, 
    error, 
    clearError,
    stopStreaming,
    config,
  } = useEdith();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const messages = currentConversation?.messages || [];

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSend = (message: string, files?: File[]) => {
    sendMessage(message, files);
  };

  const handleSelectPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const assistantName = config?.assistantName || 'Edith';

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.length === 0 && !isLoading && !isStreaming && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                {config?.welcomeMessage || `Hi! I'm ${assistantName}, your QMS assistant. How can I help you today?`}
              </p>
              <EdithSuggestedPrompts 
                onSelectPrompt={handleSelectPrompt}
                customPrompts={config?.suggestedPrompts}
                variant="grid"
              />
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div className="flex justify-start">
              <EdithStreamingMessage
                content={streamingContent}
                isStreaming={true}
              />
            </div>
          )}

          {/* Loading state */}
          {isLoading && !isStreaming && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{assistantName} is thinking...</span>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && !isStreaming && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
              <WifiOff className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={clearError}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggested prompts when there are messages */}
      {messages.length > 0 && !isLoading && !isStreaming && (
        <EdithSuggestedPrompts 
          onSelectPrompt={handleSelectPrompt}
          isLoading={isLoading}
        />
      )}

      {/* Offline banner */}
      {isOffline && (
        <div className="px-4 py-2 bg-warning/10 border-t border-warning/20 text-warning-foreground flex items-center gap-2 text-xs">
          <WifiOff className="h-3 w-3" />
          You're offline. {assistantName} needs an internet connection.
        </div>
      )}

      {/* Input area */}
      <EdithInput
        onSend={handleSend}
        isLoading={isLoading}
        isStreaming={isStreaming}
        isOffline={isOffline}
        onStop={stopStreaming}
        placeholder={`Ask ${assistantName} anything...`}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: EdithMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
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
                {message.content}
              </ReactMarkdown>
            </div>
            <EdithMessageActions 
              toolCalls={message.toolCalls} 
              messageContent={message.content} 
            />
          </>
        )}
      </div>
    </div>
  );
}
