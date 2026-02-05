export interface EdithMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: EdithToolCall[];
  toolResults?: EdithToolResult[];
  createdAt: Date;
}

export interface EdithToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface EdithToolResult {
  toolCallId: string;
  result: any;
}

export interface EdithConversation {
  id: string;
  conversationNumber: string;
  title?: string;
  messages: EdithMessage[];
  context: EdithContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface EdithContext {
  currentPage?: string;
  selectedNC?: string;
  selectedItems?: string[];
  userIntent?: string;
}

export interface EdithState {
  isOpen: boolean;
  isLoading: boolean;
  conversations: EdithConversation[];
  currentConversation: EdithConversation | null;
  error: string | null;
}

export interface EdithContextValue extends EdithState {
  openEdith: () => void;
  closeEdith: () => void;
  toggleEdith: () => void;
  sendMessage: (message: string) => Promise<void>;
  startNewConversation: () => void;
  selectConversation: (id: string) => void;
  loadConversation: (id: string) => Promise<void>;
  clearError: () => void;
  updateContext: (context: Partial<EdithContext>) => void;
}

export const QUICK_ACTIONS = [
  { id: 'show-tasks', label: 'My Tasks', icon: 'ListTodo', message: 'Show me my assigned tasks and NCs' },
  { id: 'overdue', label: 'Overdue', icon: 'AlertTriangle', message: 'Show all overdue NCs' },
  { id: 'create-nc', label: 'New NC', icon: 'Plus', message: 'Help me create a new non-conformance' },
  { id: 'dashboard', label: 'Stats', icon: 'BarChart', message: 'Show me dashboard statistics' },
] as const;
