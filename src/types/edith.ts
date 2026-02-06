export interface EdithMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: EdithToolCall[];
  toolResults?: EdithToolResult[];
  attachments?: EdithAttachment[];
  isStreaming?: boolean;
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

export interface EdithAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  downloadUrl?: string;
  parsedContent?: string;
  uploadedAt: Date;
}

export interface EdithConversation {
  id: string;
  conversationNumber: string;
  title?: string;
  messages: EdithMessage[];
  context: EdithContext;
  isPinned?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EdithContext {
  currentPage?: string;
  selectedNC?: string;
  selectedItems?: string[];
  userIntent?: string;
  pageData?: Record<string, any>;
}

export interface EdithState {
  isOpen: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  conversations: EdithConversation[];
  currentConversation: EdithConversation | null;
  error: string | null;
  streamingContent: string;
}

export interface EdithTenantConfig {
  id: string;
  tenantId: string;
  assistantName: string;
  assistantAvatarUrl?: string;
  personalityPrompt?: string;
  welcomeMessage: string;
  suggestedPrompts: string[];
  enabledTools: string[];
  monthlyMessageLimit: number;
  monthlyDocGenLimit: number;
  aiProvider: 'lovable' | 'anthropic' | 'openai' | 'google';
  aiModel: string;
  fallbackProvider?: 'lovable' | 'anthropic' | 'openai' | 'google';
}

export interface EdithUsage {
  messagesUsed: number;
  messagesLimit: number;
  docsGenerated: number;
  docsLimit: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface EdithContextValue extends EdithState {
  config: EdithTenantConfig | null;
  usage: EdithUsage | null;
  openEdith: () => void;
  closeEdith: () => void;
  toggleEdith: () => void;
  sendMessage: (message: string, attachments?: File[]) => Promise<void>;
  startNewConversation: () => void;
  selectConversation: (id: string) => void;
  loadConversation: (id: string) => Promise<void>;
  pinConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearError: () => void;
  updateContext: (context: Partial<EdithContext>) => void;
  stopStreaming: () => void;
}

export const QUICK_ACTIONS = [
  { id: 'show-tasks', label: 'My Tasks', icon: 'ListTodo', message: 'Show me my assigned tasks and NCs' },
  { id: 'overdue', label: 'Overdue', icon: 'AlertTriangle', message: 'Show all overdue NCs' },
  { id: 'create-nc', label: 'New NC', icon: 'Plus', message: 'Help me create a new non-conformance' },
  { id: 'dashboard', label: 'Stats', icon: 'BarChart', message: 'Show me dashboard statistics' },
  { id: 'iso-help', label: 'ISO Help', icon: 'FileText', message: 'What ISO 9001 clause applies to my situation?' },
  { id: 'generate-report', label: 'Report', icon: 'FileDown', message: 'Generate an NC summary report' },
] as const;

export type EdithPageContext = 
  | 'dashboard'
  | 'ncList'
  | 'ncDetail'
  | 'tasks'
  | 'audits'
  | 'surveys'
  | 'moderation'
  | 'settings'
  | 'fullPageEdith'
  | 'other';

export const PAGE_SUGGESTIONS: Record<EdithPageContext, string[]> = {
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
    "Draft corrective action for this",
    "Send reminder to responsible person"
  ],
  tasks: [
    "Show my overdue tasks",
    "Prioritize my workload",
    "What should I focus on today?"
  ],
  audits: [
    "Prepare audit checklist for Clause 10",
    "Show recent audit findings",
    "What evidence do I need?"
  ],
  surveys: [
    "Analyze survey trends",
    "Show low satisfaction areas",
    "Generate survey summary"
  ],
  moderation: [
    "Show pending moderations",
    "What's my moderation queue?",
    "Generate moderation report"
  ],
  settings: [
    "Help me configure Edith",
    "What are my usage limits?",
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
    "Help me with ISO compliance"
  ],
};
