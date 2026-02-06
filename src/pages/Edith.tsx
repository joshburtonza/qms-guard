import { useState, useCallback, useEffect } from 'react';
import { Plus, Search, Pin, Trash2, Sparkles, MessageSquare } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useEdith } from '@/hooks/useEdith';
import { EdithChat } from '@/components/edith/EdithChat';
import { EdithSuggestedPrompts } from '@/components/edith/EdithSuggestedPrompts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { EdithConversation } from '@/types/edith';

export default function Edith() {
  const { 
    currentConversation, 
    startNewConversation, 
    loadConversation,
    pinConversation,
    deleteConversation,
    sendMessage,
    config,
    usage,
  } = useEdith();
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<EdithConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load conversations
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const loadConversations = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('edith_conversations')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setConversations(data.map(c => ({
          id: c.id,
          conversationNumber: c.conversation_number,
          title: c.title,
          messages: [],
          context: c.context as any || {},
          isPinned: c.is_pinned || false,
          createdAt: new Date(c.created_at!),
          updatedAt: new Date(c.updated_at!),
        })));
      }
      setIsLoading(false);
    };

    loadConversations();
  }, [profile?.tenant_id]);

  const handleSelectConversation = useCallback(async (id: string) => {
    await loadConversation(id);
  }, [loadConversation]);

  const handleNewConversation = useCallback(async () => {
    await startNewConversation();
  }, [startNewConversation]);

  const handlePin = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await pinConversation(id);
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, isPinned: !c.isPinned } : c
    ));
  }, [pinConversation]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
  }, [deleteConversation]);

  // Group conversations by date
  const groupedConversations = conversations.reduce((groups, conv) => {
    if (conv.isPinned) {
      if (!groups.pinned) groups.pinned = [];
      groups.pinned.push(conv);
    } else if (isToday(conv.updatedAt)) {
      if (!groups.today) groups.today = [];
      groups.today.push(conv);
    } else if (isYesterday(conv.updatedAt)) {
      if (!groups.yesterday) groups.yesterday = [];
      groups.yesterday.push(conv);
    } else if (isThisWeek(conv.updatedAt)) {
      if (!groups.thisWeek) groups.thisWeek = [];
      groups.thisWeek.push(conv);
    } else {
      if (!groups.older) groups.older = [];
      groups.older.push(conv);
    }
    return groups;
  }, {} as Record<string, EdithConversation[]>);

  const filteredGroups = Object.entries(groupedConversations).reduce((acc, [key, convs]) => {
    const filtered = convs.filter(c => 
      !searchQuery || 
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.conversationNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) acc[key] = filtered;
    return acc;
  }, {} as Record<string, EdithConversation[]>);

  const assistantName = config?.assistantName || 'Edith';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-72 border-r flex flex-col bg-muted/30">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">{assistantName}</h1>
              <p className="text-xs text-muted-foreground">QMS AI Assistant</p>
            </div>
          </div>
          <Button 
            onClick={handleNewConversation} 
            className="w-full gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Loading conversations...
              </div>
            ) : Object.keys(filteredGroups).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No conversations yet
              </div>
            ) : (
              <>
                {filteredGroups.pinned && (
                  <ConversationGroup
                    title="Pinned"
                    conversations={filteredGroups.pinned}
                    currentId={currentConversation?.id}
                    onSelect={handleSelectConversation}
                    onPin={handlePin}
                    onDelete={handleDelete}
                  />
                )}
                {filteredGroups.today && (
                  <ConversationGroup
                    title="Today"
                    conversations={filteredGroups.today}
                    currentId={currentConversation?.id}
                    onSelect={handleSelectConversation}
                    onPin={handlePin}
                    onDelete={handleDelete}
                  />
                )}
                {filteredGroups.yesterday && (
                  <ConversationGroup
                    title="Yesterday"
                    conversations={filteredGroups.yesterday}
                    currentId={currentConversation?.id}
                    onSelect={handleSelectConversation}
                    onPin={handlePin}
                    onDelete={handleDelete}
                  />
                )}
                {filteredGroups.thisWeek && (
                  <ConversationGroup
                    title="This Week"
                    conversations={filteredGroups.thisWeek}
                    currentId={currentConversation?.id}
                    onSelect={handleSelectConversation}
                    onPin={handlePin}
                    onDelete={handleDelete}
                  />
                )}
                {filteredGroups.older && (
                  <ConversationGroup
                    title="Older"
                    conversations={filteredGroups.older}
                    currentId={currentConversation?.id}
                    onSelect={handleSelectConversation}
                    onPin={handlePin}
                    onDelete={handleDelete}
                  />
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Usage Footer */}
        {usage && (
          <div className="p-3 border-t bg-muted/50">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Messages</span>
                <span>{usage.messagesUsed} / {usage.messagesLimit}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min((usage.messagesUsed / usage.messagesLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <EdithChat />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Welcome to {assistantName}</h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Your AI-powered QMS assistant. Ask about NCs, ISO compliance, generate reports, and more.
            </p>
            <EdithSuggestedPrompts 
              onSelectPrompt={sendMessage}
              variant="grid"
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationGroupProps {
  title: string;
  conversations: EdithConversation[];
  currentId?: string;
  onSelect: (id: string) => void;
  onPin: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

function ConversationGroup({ 
  title, 
  conversations, 
  currentId, 
  onSelect, 
  onPin, 
  onDelete 
}: ConversationGroupProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground px-2 py-1">{title}</h3>
      {conversations.map(conv => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm transition-colors group",
            currentId === conv.id
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted"
          )}
        >
          <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">
              {conv.title || conv.conversationNumber}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {format(conv.updatedAt, 'MMM d, h:mm a')}
            </p>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => onPin(conv.id, e)}
            >
              <Pin className={cn("h-3 w-3", conv.isPinned && "fill-current")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => onDelete(conv.id, e)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </button>
      ))}
    </div>
  );
}
