import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { Json } from '@/integrations/supabase/types';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { 
  EdithContextValue, 
  EdithState, 
  EdithMessage, 
  EdithConversation, 
  EdithContext as EdithCtx,
  EdithTenantConfig,
  EdithUsage,
} from '@/types/edith';

const EdithContext = createContext<EdithContextValue | undefined>(undefined);

const initialState: EdithState = {
  isOpen: false,
  isLoading: false,
  isStreaming: false,
  conversations: [],
  currentConversation: null,
  error: null,
  streamingContent: '',
};

export function EdithProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EdithState>(initialState);
  const [config, setConfig] = useState<EdithTenantConfig | null>(null);
  const [usage, setUsage] = useState<EdithUsage | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();

  // Load tenant config
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const loadConfig = async () => {
      const { data, error } = await supabase
        .from('edith_tenant_config')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (!error && data) {
        setConfig({
          id: data.id,
          tenantId: data.tenant_id,
          assistantName: data.assistant_name || 'Edith',
          assistantAvatarUrl: data.assistant_avatar_url,
          personalityPrompt: data.personality_prompt,
          welcomeMessage: data.welcome_message || 'Hi! I\'m Edith, your QMS AI assistant.',
          suggestedPrompts: (data.suggested_prompts as string[]) || [],
          enabledTools: (data.enabled_tools as string[]) || [],
          monthlyMessageLimit: data.monthly_message_limit || 500,
          monthlyDocGenLimit: data.monthly_doc_gen_limit || 20,
          aiProvider: data.ai_provider as any || 'lovable',
          aiModel: data.ai_model || 'google/gemini-3-flash-preview',
          fallbackProvider: data.fallback_provider as any,
        });
      }
    };

    loadConfig();
  }, [profile?.tenant_id]);

  // Load usage stats
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const loadUsage = async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('edith_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', startOfMonth.toISOString());

      const { data: tokenData } = await supabase
        .from('edith_usage_log')
        .select('input_tokens, output_tokens, estimated_cost_usd')
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', startOfMonth.toISOString());

      const totalTokens = tokenData?.reduce((sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0), 0) || 0;
      const totalCost = tokenData?.reduce((sum, r) => sum + (parseFloat(r.estimated_cost_usd as any) || 0), 0) || 0;

      setUsage({
        messagesUsed: count || 0,
        messagesLimit: config?.monthlyMessageLimit || 500,
        docsGenerated: 0, // TODO: Track separately
        docsLimit: config?.monthlyDocGenLimit || 20,
        totalTokens,
        estimatedCost: totalCost,
      });
    };

    loadUsage();
  }, [profile?.tenant_id, config?.monthlyMessageLimit, config?.monthlyDocGenLimit]);

  // Create new conversation
  const createConversation = useCallback(async (): Promise<EdithConversation | null> => {
    if (!user || !profile?.tenant_id) return null;

    try {
      const insertData = {
        user_id: user.id,
        tenant_id: profile.tenant_id,
        context: { currentPage: location.pathname } as unknown as Json,
        conversation_number: '',
      };
      
      const { data, error } = await supabase
        .from('edith_conversations')
        .insert([insertData])
        .select('*')
        .single();

      if (error) throw error;

      const newConversation: EdithConversation = {
        id: data.id,
        conversationNumber: data.conversation_number,
        title: data.title,
        messages: [],
        context: data.context as EdithCtx || {},
        isPinned: data.is_pinned || false,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }, [user, profile?.tenant_id, location.pathname]);

  // Start new conversation
  const startNewConversation = useCallback(async () => {
    const newConversation = await createConversation();
    if (newConversation) {
      setState(prev => ({
        ...prev,
        currentConversation: newConversation,
        conversations: [newConversation, ...prev.conversations],
        streamingContent: '',
      }));
    }
  }, [createConversation]);

  // Open Edith
  const openEdith = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
    if (!state.currentConversation) {
      startNewConversation();
    }
  }, [state.currentConversation, startNewConversation]);

  // Close Edith
  const closeEdith = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Toggle Edith
  const toggleEdith = useCallback(() => {
    if (state.isOpen) {
      closeEdith();
    } else {
      openEdith();
    }
  }, [state.isOpen, closeEdith, openEdith]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false, isLoading: false }));
  }, []);

  // Send message with streaming support
  const sendMessage = useCallback(async (messageContent: string, attachments?: File[]) => {
    if (!messageContent.trim() && (!attachments || attachments.length === 0)) return;
    if (state.isLoading || state.isStreaming) return;
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to use Edith',
        variant: 'destructive',
      });
      return;
    }

    // Ensure we have a conversation
    let conversation = state.currentConversation;
    if (!conversation) {
      conversation = await createConversation();
      if (!conversation) {
        toast({
          title: 'Error',
          description: 'Failed to start conversation',
          variant: 'destructive',
        });
        return;
      }
      setState(prev => ({
        ...prev,
        currentConversation: conversation,
        conversations: [conversation!, ...prev.conversations],
      }));
    }

    // Add user message
    const userMessage: EdithMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      createdAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      streamingContent: '',
      currentConversation: prev.currentConversation
        ? {
            ...prev.currentConversation,
            messages: [...prev.currentConversation.messages, userMessage],
          }
        : null,
    }));

    try {
      // Save user message to database
      await supabase.from('edith_messages').insert({
        conversation_id: conversation.id,
        tenant_id: profile?.tenant_id,
        role: 'user',
        content: messageContent,
      });

      // Get session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Prepare messages for API
      const apiMessages = [
        ...state.currentConversation?.messages.map(m => ({
          role: m.role,
          content: m.content,
        })) || [],
        { role: 'user' as const, content: messageContent },
      ];

      // Create abort controller for streaming
      abortControllerRef.current = new AbortController();

      // Call Edith API with streaming
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edith-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            conversationId: conversation.id,
            stream: true,
            pageContext: {
              currentPage: location.pathname,
            },
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      // Check if streaming response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        // Handle SSE streaming
        setState(prev => ({ ...prev, isLoading: false, isStreaming: true }));
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullContent += parsed.content;
                    setState(prev => ({ ...prev, streamingContent: fullContent }));
                  }
                } catch {
                  // Ignore parse errors for partial chunks
                }
              }
            }
          }
        }
        
        // Finalize streaming message
        const assistantMessage: EdithMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullContent,
          createdAt: new Date(),
        };

        // Save assistant message
        await supabase.from('edith_messages').insert({
          conversation_id: conversation.id,
          tenant_id: profile?.tenant_id,
          role: 'assistant',
          content: fullContent,
        });

        setState(prev => ({
          ...prev,
          isStreaming: false,
          streamingContent: '',
          currentConversation: prev.currentConversation
            ? {
                ...prev.currentConversation,
                messages: [...prev.currentConversation.messages, assistantMessage],
              }
            : null,
        }));
      } else {
        // Non-streaming response (fallback)
        const data = await response.json();

        const assistantMessage: EdithMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          toolCalls: data.tool_calls,
          createdAt: new Date(),
        };

        await supabase.from('edith_messages').insert({
          conversation_id: conversation.id,
          tenant_id: profile?.tenant_id,
          role: 'assistant',
          content: data.message,
          tool_calls: data.tool_calls,
        });

        setState(prev => ({
          ...prev,
          isLoading: false,
          currentConversation: prev.currentConversation
            ? {
                ...prev.currentConversation,
                messages: [...prev.currentConversation.messages, assistantMessage],
              }
            : null,
        }));
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled
        return;
      }
      
      console.error('Edith chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        error: errorMessage,
      }));

      toast({
        title: 'Edith Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [state.isLoading, state.isStreaming, state.currentConversation, user, profile?.tenant_id, createConversation, location.pathname]);

  // Select conversation (from memory)
  const selectConversation = useCallback((id: string) => {
    const conversation = state.conversations.find(c => c.id === id);
    if (conversation) {
      setState(prev => ({ ...prev, currentConversation: conversation }));
    }
  }, [state.conversations]);

  // Load conversation from database
  const loadConversation = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { data: convData, error: convError } = await supabase
        .from('edith_conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (convError) throw convError;

      const { data: messagesData, error: msgError } = await supabase
        .from('edith_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      const loadedConversation: EdithConversation = {
        id: convData.id,
        conversationNumber: convData.conversation_number,
        title: convData.title,
        messages: (messagesData || []).map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolCalls: m.tool_calls as any,
          createdAt: new Date(m.created_at),
        })),
        context: convData.context as EdithCtx || {},
        isPinned: convData.is_pinned || false,
        createdAt: new Date(convData.created_at),
        updatedAt: new Date(convData.updated_at),
      };

      setState(prev => ({
        ...prev,
        currentConversation: loadedConversation,
        conversations: prev.conversations.some(c => c.id === id)
          ? prev.conversations.map(c => c.id === id ? loadedConversation : c)
          : [loadedConversation, ...prev.conversations],
      }));
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversation',
        variant: 'destructive',
      });
    }
  }, [user]);

  // Pin conversation
  const pinConversation = useCallback(async (id: string) => {
    const conversation = state.conversations.find(c => c.id === id);
    if (!conversation) return;

    const newPinned = !conversation.isPinned;

    try {
      await supabase
        .from('edith_conversations')
        .update({ is_pinned: newPinned })
        .eq('id', id);

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(c =>
          c.id === id ? { ...c, isPinned: newPinned } : c
        ),
        currentConversation: prev.currentConversation?.id === id
          ? { ...prev.currentConversation, isPinned: newPinned }
          : prev.currentConversation,
      }));
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  }, [state.conversations]);

  // Delete conversation (soft delete)
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await supabase
        .from('edith_conversations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.id !== id),
        currentConversation: prev.currentConversation?.id === id ? null : prev.currentConversation,
      }));

      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been removed',
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Update context
  const updateContext = useCallback((context: Partial<EdithCtx>) => {
    setState(prev => ({
      ...prev,
      currentConversation: prev.currentConversation
        ? {
            ...prev.currentConversation,
            context: { ...prev.currentConversation.context, ...context },
          }
        : null,
    }));
  }, []);

  // Update context when location changes
  useEffect(() => {
    updateContext({ currentPage: location.pathname });
  }, [location.pathname, updateContext]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleEdith();
      }
      if (e.key === 'Escape' && state.isOpen) {
        closeEdith();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleEdith, closeEdith, state.isOpen]);

  const value: EdithContextValue = {
    ...state,
    config,
    usage,
    openEdith,
    closeEdith,
    toggleEdith,
    sendMessage,
    startNewConversation,
    selectConversation,
    loadConversation,
    pinConversation,
    deleteConversation,
    clearError,
    updateContext,
    stopStreaming,
  };

  return (
    <EdithContext.Provider value={value}>
      {children}
    </EdithContext.Provider>
  );
}

export function useEdith() {
  const context = useContext(EdithContext);
  if (context === undefined) {
    throw new Error('useEdith must be used within an EdithProvider');
  }
  return context;
}
