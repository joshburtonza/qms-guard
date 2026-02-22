import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Bot, Sparkles, Key, BarChart3, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import type { EdithTenantConfig, EdithUsage } from '@/types/edith';

const AI_PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI (Default)', models: ['google/gemini-3-flash-preview', 'google/gemini-2.5-flash', 'openai/gpt-4o'] },
  { value: 'anthropic', label: 'Anthropic Claude', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { value: 'google', label: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
];

export default function EdithSettings() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<Partial<EdithTenantConfig>>({});
  const [usage, setUsage] = useState<EdithUsage | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const isAdmin = userRoles.includes('site_admin') || userRoles.includes('super_admin');

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const loadData = async () => {
      setIsLoading(true);

      // Load user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id);
      
      if (rolesData) {
        setUserRoles(rolesData.map(r => r.role));
      }

      // Load config
      const { data: configData } = await supabase
        .from('edith_tenant_config')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (configData) {
        setConfig({
          id: configData.id,
          tenantId: configData.tenant_id,
          assistantName: configData.assistant_name || 'Edith',
          assistantAvatarUrl: configData.assistant_avatar_url,
          personalityPrompt: configData.personality_prompt,
          welcomeMessage: configData.welcome_message || "Hi! I'm Edith, your QMS AI assistant.",
          suggestedPrompts: (configData.suggested_prompts as string[]) || [],
          monthlyMessageLimit: configData.monthly_message_limit || 500,
          monthlyDocGenLimit: configData.monthly_doc_gen_limit || 20,
          aiProvider: configData.ai_provider as any || 'lovable',
          aiModel: configData.ai_model || 'google/gemini-3-flash-preview',
          fallbackProvider: configData.fallback_provider as any,
        });
      }

      // Load usage
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
        messagesLimit: configData?.monthly_message_limit || 500,
        docsGenerated: 0,
        docsLimit: configData?.monthly_doc_gen_limit || 20,
        totalTokens,
        estimatedCost: totalCost,
      });

      setIsLoading(false);
    };

    loadData();
  }, [profile?.tenant_id]);

  const handleSave = async () => {
    if (!profile?.tenant_id || !isAdmin) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('edith_tenant_config')
        .upsert({
          tenant_id: profile.tenant_id,
          assistant_name: config.assistantName,
          assistant_avatar_url: config.assistantAvatarUrl,
          personality_prompt: config.personalityPrompt,
          welcome_message: config.welcomeMessage,
          suggested_prompts: config.suggestedPrompts,
          monthly_message_limit: config.monthlyMessageLimit,
          monthly_doc_gen_limit: config.monthlyDocGenLimit,
          ai_provider: config.aiProvider,
          ai_model: config.aiModel,
          fallback_provider: config.fallbackProvider,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Edith configuration has been updated.',
      });
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProvider = AI_PROVIDERS.find(p => p.value === config.aiProvider);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Edith AI Settings
              </h1>
              <p className="text-muted-foreground">
                Configure your AI assistant's behavior and appearance
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Assistant Branding
              </CardTitle>
              <CardDescription>
                Customize how your AI assistant appears to users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assistantName">Assistant Name</Label>
                <Input
                  id="assistantName"
                  value={config.assistantName || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, assistantName: e.target.value }))}
                  placeholder="Edith"
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">
                  The name displayed in the chat interface
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcomeMessage">Welcome Message</Label>
                <Textarea
                  id="welcomeMessage"
                  value={config.welcomeMessage || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                  placeholder="Hi! I'm your QMS assistant..."
                  rows={3}
                  disabled={!isAdmin}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personalityPrompt">Personality Additions</Label>
                <Textarea
                  id="personalityPrompt"
                  value={config.personalityPrompt || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, personalityPrompt: e.target.value }))}
                  placeholder="Additional personality traits or company-specific context..."
                  rows={4}
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">
                  Extra instructions to customize the assistant's personality
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                AI Provider
              </CardTitle>
              <CardDescription>
                Choose which AI model powers your assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Provider</Label>
                <Select
                  value={config.aiProvider}
                  onValueChange={(value) => setConfig(prev => ({ 
                    ...prev, 
                    aiProvider: value as any,
                    aiModel: AI_PROVIDERS.find(p => p.value === value)?.models[0] || ''
                  }))}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS.map(provider => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={config.aiModel}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, aiModel: value }))}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProvider?.models.map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fallback Provider</Label>
                <Select
                  value={config.fallbackProvider || ''}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, fallbackProvider: value as any || undefined }))}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (no fallback)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {AI_PROVIDERS.filter(p => p.value !== config.aiProvider).map(provider => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used if the primary provider fails or is unavailable
                </p>
              </div>

              {config.aiProvider !== 'lovable' && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
                  <p className="font-medium text-warning-foreground">API Key Required</p>
                  <p className="text-muted-foreground mt-1">
                    You'll need to add the {selectedProvider?.label} API key in your backend secrets.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage This Month
              </CardTitle>
              <CardDescription>
                Track your AI assistant usage and limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Messages</span>
                  <span className="font-medium">{usage?.messagesUsed || 0} / {usage?.messagesLimit || 500}</span>
                </div>
                <Progress value={((usage?.messagesUsed || 0) / (usage?.messagesLimit || 500)) * 100} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Documents Generated</span>
                  <span className="font-medium">{usage?.docsGenerated || 0} / {usage?.docsLimit || 20}</span>
                </div>
                <Progress value={((usage?.docsGenerated || 0) / (usage?.docsLimit || 20)) * 100} />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold">{(usage?.totalTokens || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Cost</p>
                  <p className="text-2xl font-bold">${(usage?.estimatedCost || 0).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Usage Limits
              </CardTitle>
              <CardDescription>
                Set monthly limits for AI usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="messageLimit">Monthly Message Limit</Label>
                <Input
                  id="messageLimit"
                  type="number"
                  value={config.monthlyMessageLimit || 500}
                  onChange={(e) => setConfig(prev => ({ ...prev, monthlyMessageLimit: parseInt(e.target.value) || 500 }))}
                  disabled={!isAdmin}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="docLimit">Monthly Document Generation Limit</Label>
                <Input
                  id="docLimit"
                  type="number"
                  value={config.monthlyDocGenLimit || 20}
                  onChange={(e) => setConfig(prev => ({ ...prev, monthlyDocGenLimit: parseInt(e.target.value) || 20 }))}
                  disabled={!isAdmin}
                />
              </div>

              <div className="pt-2">
                <Badge variant="outline">
                  Resets on the 1st of each month
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
