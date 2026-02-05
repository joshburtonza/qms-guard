import { useEffect, useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

interface ConversationSummary {
  id: string;
  conversation_number: string;
  title: string | null;
  created_at: string;
  message_count: number;
}

interface EdithConversationHistoryProps {
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
}

export function EdithConversationHistory({ 
  onSelectConversation, 
  currentConversationId 
}: EdithConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      try {
        const { data, error } = await supabase
          .from('edith_conversations')
          .select(`
            id,
            conversation_number,
            title,
            created_at,
            edith_messages(id)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const summaries: ConversationSummary[] = (data || []).map(conv => ({
          id: conv.id,
          conversation_number: conv.conversation_number,
          title: conv.title,
          created_at: conv.created_at,
          message_count: (conv.edith_messages as any[])?.length || 0,
        }));

        setConversations(summaries);
      } catch (error) {
        console.error('Failed to fetch conversation history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No previous conversations
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px]">
      <div className="space-y-1 p-2">
        {conversations.map((conv) => (
          <Button
            key={conv.id}
            variant="ghost"
            size="sm"
            className={cn(
              'w-full justify-start text-left h-auto py-2 px-3',
              currentConversationId === conv.id && 'bg-accent'
            )}
            onClick={() => onSelectConversation(conv.id)}
          >
            <div className="flex items-start gap-2 w-full">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {conv.title || conv.conversation_number}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(conv.created_at)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {conv.message_count} messages
                </span>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
