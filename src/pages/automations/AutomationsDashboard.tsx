import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Mail,
  RefreshCw,
  Settings2,
  Activity,
  Calendar,
  Database,
  Timer,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface WorkflowConfig {
  id: string;
  tenant_id: string;
  workflow_key: string;
  workflow_name: string;
  description: string | null;
  is_enabled: boolean;
  trigger_type: string;
  trigger_config: any;
  conditions: any;
  actions: any;
  recipients: string[];
  email_subject_template: string | null;
  email_body_template: string | null;
  schedule_interval: string | null;
  last_executed_at: string | null;
  execution_count: number;
  created_at: string;
  updated_at: string;
}

interface ExecutionLog {
  id: string;
  workflow_id: string;
  nc_id: string | null;
  status: string;
  recipients_notified: string[] | null;
  error_message: string | null;
  execution_details: any;
  executed_at: string;
}

const TRIGGER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  database_change: Database,
  scheduled: Timer,
  manual: Play,
};

const TRIGGER_LABELS: Record<string, string> = {
  database_change: 'Database Change',
  scheduled: 'Scheduled',
  manual: 'Manual',
};

const WF_COLORS: Record<string, string> = {
  wf1_qa_classify: 'bg-blue-500',
  wf2_rp_investigation: 'bg-emerald-500',
  wf3_declined_rework: 'bg-red-500',
  wf4_second_approval: 'bg-purple-500',
  wf5_first_approval: 'bg-amber-500',
  wf6_tm_notification: 'bg-teal-500',
  wf7_reminder: 'bg-orange-500',
};

export default function AutomationsDashboard() {
  const { toast } = useToast();
  const { roles } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowConfig | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    recipients: '',
    email_subject_template: '',
    email_body_template: '',
    schedule_interval: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = roles.includes('super_admin') || roles.includes('site_admin');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [wfResult, logResult] = await Promise.all([
        supabase
          .from('workflow_configurations')
          .select('*')
          .order('workflow_key'),
        supabase
          .from('workflow_execution_log')
          .select('*')
          .order('executed_at', { ascending: false })
          .limit(50),
      ]);

      if (wfResult.data) setWorkflows(wfResult.data as any);
      if (logResult.data) setExecutionLogs(logResult.data as any);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleWorkflow(workflow: WorkflowConfig) {
    if (!isAdmin) return;
    
    const newEnabled = !workflow.is_enabled;
    const { error } = await supabase
      .from('workflow_configurations')
      .update({ is_enabled: newEnabled })
      .eq('id', workflow.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update workflow.' });
      return;
    }

    setWorkflows(prev =>
      prev.map(w => w.id === workflow.id ? { ...w, is_enabled: newEnabled } : w)
    );

    toast({
      title: newEnabled ? 'Workflow Enabled' : 'Workflow Disabled',
      description: `${workflow.workflow_name} has been ${newEnabled ? 'enabled' : 'disabled'}.`,
    });
  }

  function openEditDialog(workflow: WorkflowConfig) {
    setSelectedWorkflow(workflow);
    setEditForm({
      recipients: Array.isArray(workflow.recipients) ? workflow.recipients.join(', ') : '',
      email_subject_template: workflow.email_subject_template || '',
      email_body_template: workflow.email_body_template || '',
      schedule_interval: workflow.schedule_interval || '',
    });
    setEditDialogOpen(true);
  }

  async function saveWorkflowEdit() {
    if (!selectedWorkflow || !isAdmin) return;
    setIsSaving(true);

    const recipients = editForm.recipients
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from('workflow_configurations')
      .update({
        recipients,
        email_subject_template: editForm.email_subject_template,
        email_body_template: editForm.email_body_template,
        schedule_interval: editForm.schedule_interval || null,
      })
      .eq('id', selectedWorkflow.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save changes.' });
    } else {
      toast({ title: 'Saved', description: 'Workflow configuration updated.' });
      setEditDialogOpen(false);
      fetchData();
    }
    setIsSaving(false);
  }

  const activeCount = workflows.filter(w => w.is_enabled).length;
  const totalExecutions = workflows.reduce((sum, w) => sum + w.execution_count, 0);
  const recentFailures = executionLogs.filter(l => l.status === 'failed').length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent" />
              Automations
            </h1>
            <p className="text-muted-foreground">
              Manage workflow automations, email notifications, and scheduled tasks
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Workflows</p>
                  <p className="text-3xl font-bold">{activeCount}<span className="text-lg text-muted-foreground">/{workflows.length}</span></p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Play className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Executions</p>
                  <p className="text-3xl font-bold">{totalExecutions}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recent Failures</p>
                  <p className="text-3xl font-bold">{recentFailures}</p>
                </div>
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center",
                  recentFailures > 0 ? "bg-red-100" : "bg-emerald-100"
                )}>
                  {recentFailures > 0 ? (
                    <XCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows">Workflows ({workflows.length})</TabsTrigger>
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
          </TabsList>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-4 mt-4">
            {workflows.map((wf) => {
              const TriggerIcon = TRIGGER_ICONS[wf.trigger_type] || Database;
              const wfLogs = executionLogs.filter(l => l.workflow_id === wf.id);
              const lastLog = wfLogs[0];
              const colorClass = WF_COLORS[wf.workflow_key] || 'bg-gray-500';

              return (
                <Card key={wf.id} className={cn(!wf.is_enabled && 'opacity-60')}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Color bar + info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className={cn('w-1.5 h-16 rounded-full flex-shrink-0', colorClass)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{wf.workflow_name}</h3>
                            <Badge variant="outline" className="text-xs">
                              <TriggerIcon className="h-3 w-3 mr-1" />
                              {TRIGGER_LABELS[wf.trigger_type]}
                            </Badge>
                            {wf.schedule_interval && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Every {wf.schedule_interval}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {wf.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {Array.isArray(wf.recipients) ? wf.recipients.length : 0} recipient(s)
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              {wf.execution_count} executions
                            </span>
                            {wf.last_executed_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Last: {formatDistanceToNow(new Date(wf.last_executed_at), { addSuffix: true })}
                              </span>
                            )}
                            {lastLog && (
                              <span className={cn(
                                "flex items-center gap-1",
                                lastLog.status === 'failed' ? 'text-destructive' : 'text-emerald-600'
                              )}>
                                {lastLog.status === 'failed' ? (
                                  <XCircle className="h-3 w-3" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                {lastLog.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 sm:flex-shrink-0">
                        {isAdmin && (
                          <>
                            <Switch
                              checked={wf.is_enabled}
                              onCheckedChange={() => toggleWorkflow(wf)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(wf)}
                            >
                              <Settings2 className="h-4 w-4 mr-1" />
                              Configure
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {workflows.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No workflows configured</p>
                  <p className="text-sm">Workflows will appear here once they're set up for your tenant.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Execution Logs Tab */}
          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Executions</CardTitle>
                <CardDescription>Last 50 workflow executions across all automations</CardDescription>
              </CardHeader>
              <CardContent>
                {executionLogs.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No execution logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {executionLogs.map(log => {
                      const wf = workflows.find(w => w.id === log.workflow_id);
                      return (
                        <div
                          key={log.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          {log.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          ) : log.status === 'failed' ? (
                            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {wf?.workflow_name || 'Unknown Workflow'}
                            </p>
                            {log.error_message && (
                              <p className="text-xs text-destructive truncate">{log.error_message}</p>
                            )}
                            {log.recipients_notified && log.recipients_notified.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                → {log.recipients_notified.join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(log.executed_at), 'dd MMM HH:mm')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Workflow Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Workflow</DialogTitle>
            <DialogDescription>
              {selectedWorkflow?.workflow_name} — Edit recipients, email templates, and schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Recipients */}
            <div className="space-y-2">
              <Label htmlFor="recipients">Recipients</Label>
              <Input
                id="recipients"
                value={editForm.recipients}
                onChange={e => setEditForm(prev => ({ ...prev, recipients: e.target.value }))}
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated emails. Use {'{{responsible_person_email}}'} or {'{{training_manager}}'} for dynamic recipients.
              </p>
            </div>

            {/* Schedule Interval (only for scheduled workflows) */}
            {selectedWorkflow?.trigger_type === 'scheduled' && (
              <div className="space-y-2">
                <Label htmlFor="schedule">Reminder Interval</Label>
                <Select
                  value={editForm.schedule_interval}
                  onValueChange={v => setEditForm(prev => ({ ...prev, schedule_interval: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 day">Every day</SelectItem>
                    <SelectItem value="2 days">Every 2 days</SelectItem>
                    <SelectItem value="3 days">Every 3 days</SelectItem>
                    <SelectItem value="5 days">Every 5 days</SelectItem>
                    <SelectItem value="7 days">Every 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Email Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={editForm.email_subject_template}
                onChange={e => setEditForm(prev => ({ ...prev, email_subject_template: e.target.value }))}
              />
            </div>

            {/* Email Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Email Body Template</Label>
              <Textarea
                id="body"
                value={editForm.email_body_template}
                onChange={e => setEditForm(prev => ({ ...prev, email_body_template: e.target.value }))}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Available variables: {'{{nc_number}}, {{initiator_name}}, {{responsible_person}}, {{description}}, {{root_cause}}, {{corrective_actions}}, {{due_date_for_closing}}, {{risk_classification}}, {{overdue}}'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveWorkflowEdit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
