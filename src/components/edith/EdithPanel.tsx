import { useState, useCallback } from 'react';
import { X, Sparkles, Plus, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useEdith } from '@/hooks/useEdith';
import { EdithChat } from './EdithChat';
import { EdithToolbar } from './EdithToolbar';
import { EdithContextBar } from './EdithContextBar';
import { EdithConversationHistory } from './EdithConversationHistory';

export function EdithPanel() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { isOpen, closeEdith, startNewConversation, currentConversation, loadConversation } = useEdith();

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    await loadConversation(conversationId);
    setHistoryOpen(false);
  }, [loadConversation]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeEdith()}>
      <DialogContent
        hideCloseButton
        overlayClassName="backdrop-blur-sm bg-black/50"
        className="w-screen h-screen max-w-none max-h-none rounded-none p-0 flex flex-col gap-0 border-0 sm:w-[90vw] sm:h-[85vh] sm:max-w-[700px] sm:max-h-[85vh] sm:rounded-xl sm:border"
      >
        {/* Header */}
        <div className="border-b p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-background" />
              </div>
              <div>
                <DialogTitle className="text-left text-base">Edith</DialogTitle>
                <p className="text-xs text-muted-foreground">QMS AI Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setHistoryOpen(!historyOpen)}
                title="Conversation history"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={startNewConversation}
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={closeEdith}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Context Bar - Shows what Edith sees */}
        <EdithContextBar />

        {/* Conversation History (Collapsible) */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-4 py-2 h-auto border-b rounded-none text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <History className="h-3 w-3" />
                Previous Conversations
              </span>
              {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-b">
            <EdithConversationHistory 
              onSelectConversation={handleSelectConversation}
              currentConversationId={currentConversation?.id}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Quick Actions Toolbar */}
        <EdithToolbar />

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden">
          <EdithChat />
        </div>

        {/* Footer */}
        {currentConversation && (
          <div className="border-t px-4 py-2 bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              {currentConversation.conversationNumber}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
