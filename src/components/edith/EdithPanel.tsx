import { X, Sparkles, Plus, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useEdith } from '@/hooks/useEdith';
import { EdithChat } from './EdithChat';
import { EdithToolbar } from './EdithToolbar';

export function EdithPanel() {
  const { isOpen, closeEdith, startNewConversation, currentConversation } = useEdith();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeEdith()}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[400px] p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="border-b p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-left">Edith</SheetTitle>
                <p className="text-xs text-muted-foreground">QMS AI Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
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
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
}
